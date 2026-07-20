// ベンチマークの司令塔。各テストを複数回計測して中央値とブレ（変動係数）を出し、
// 5段階レーティングと総合ランク判定まで行う。すべて端末内で完結し外部送信はしない。
import { runCpuFor, runMemoryFor, createGpuRunner } from './benchKernels';
// Web Worker はビルドに埋め込む（単一ファイル配信でも動くようインライン化）。
import BenchWorker from './bench.worker?worker&inline';

export type Rating = {
  /** 1〜5。0 は計測不可。 */
  stars: number;
  label: string;
};

export type BenchResult = {
  key: string;
  label: string;
  /** 生の計測値（中央値）。例: "30.9 M ops/s" */
  metric: string;
  /** 正規化スコア（大きいほど速い） */
  score: number;
  rating: Rating;
  /** 計測ブレ（変動係数）。% 表示。 */
  cvPercent: number;
  available: boolean;
};

export type BenchOutcome = {
  results: BenchResult[];
  total: number;
  tier: { label: string; description: string };
  /** 計測全体の信頼度 */
  consistency: { level: 'good' | 'fair' | 'poor'; label: string; maxCv: number };
};

export type BenchProgress = {
  phase: string;
  ratio: number;
};

// 1ラウンドの計測時間と繰り返し回数。中央値を採ってブレを抑える。
const ROUND_MS = 300;
const ROUNDS = 3;
const ROUNDS_MULTI = 2; // ワーカー起動コストがあるので少なめ

// スコア正規化係数（基準ユニット ≈ 100 になる目安）。
// 実機データが集まったら基準端末に合わせて調整する。
const SCALE = {
  cpuSingle: 1_500_000, // ops/s
  cpuMulti: 1_500_000, // ops/s
  memory: 200 * 1024 * 1024, // bytes/s
  gpu: 1_500, // passes/s
};

// 各テスト共通のレーティングしきい値（正規化スコア基準・目安）。
const TIERS: Array<{ min: number; label: string }> = [
  { min: 1000, label: '最速級' },
  { min: 400, label: '高速' },
  { min: 150, label: '標準' },
  { min: 50, label: 'エントリー級' },
  { min: 0, label: '控えめ' },
];

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 変動係数（標準偏差 / 平均）。計測のブレの大きさ。 */
function coeffVar(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean === 0) return 0;
  const variance =
    xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(variance) / mean;
}

function ratingFor(score: number): Rating {
  const idx = TIERS.findIndex((t) => score >= t.min);
  // TIERS は降順。最速級=5★ … 控えめ=1★
  const stars = TIERS.length - idx;
  return { stars, label: TIERS[idx].label };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function finishResult(
  key: string,
  label: string,
  values: number[],
  scale: number,
  fmt: (v: number) => string,
): BenchResult {
  const med = median(values);
  const score = Math.round((med / scale) * 100);
  return {
    key,
    label,
    metric: fmt(med),
    score,
    rating: ratingFor(score),
    cvPercent: Math.round(coeffVar(values) * 1000) / 10,
    available: true,
  };
}

async function benchCpuSingle(): Promise<BenchResult> {
  runCpuFor(120); // ウォームアップ
  const values: number[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    await delay(0);
    const iters = runCpuFor(ROUND_MS);
    values.push((iters / ROUND_MS) * 1000);
  }
  return finishResult(
    'cpu-single',
    'CPU シングルコア',
    values,
    SCALE.cpuSingle,
    (v) => `${(v / 1e6).toFixed(1)} M ops/s`,
  );
}

async function benchMemory(): Promise<BenchResult> {
  const values: number[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    await delay(0);
    const bytes = runMemoryFor(ROUND_MS);
    values.push((bytes / ROUND_MS) * 1000);
  }
  return finishResult(
    'memory',
    'メモリ帯域',
    values,
    SCALE.memory,
    (v) => `${(v / 1024 ** 3).toFixed(1)} GB/s`,
  );
}

async function benchGpu(): Promise<BenchResult> {
  let runner: ReturnType<typeof createGpuRunner> | null = null;
  try {
    runner = createGpuRunner();
    runner.run(120); // ウォームアップ
    const values: number[] = [];
    for (let r = 0; r < ROUNDS; r++) {
      await delay(0);
      const passes = runner.run(ROUND_MS);
      values.push((passes / ROUND_MS) * 1000);
    }
    return finishResult(
      'gpu',
      'GPU 描画',
      values,
      SCALE.gpu,
      (v) => `${Math.round(v).toLocaleString()} passes/s`,
    );
  } catch {
    return {
      key: 'gpu',
      label: 'GPU 描画',
      metric: '計測不可（WebGL 制限）',
      score: 0,
      rating: { stars: 0, label: '—' },
      cvPercent: 0,
      available: false,
    };
  } finally {
    runner?.dispose();
  }
}

async function benchCpuMulti(): Promise<BenchResult> {
  const cores = navigator.hardwareConcurrency || 2;
  const workers: Worker[] = [];

  function runRound(): Promise<number> {
    return Promise.all(
      workers.map(
        (w) =>
          new Promise<number>((resolve, reject) => {
            w.onerror = (e) => reject(e);
            w.onmessage = (e: MessageEvent<{ iterations: number }>) =>
              resolve(e.data.iterations);
            w.postMessage({ durationMs: ROUND_MS });
          }),
      ),
    ).then((rs) => rs.reduce((a, b) => a + b, 0));
  }

  try {
    for (let i = 0; i < cores; i++) workers.push(new BenchWorker());
    const values: number[] = [];
    for (let r = 0; r < ROUNDS_MULTI; r++) {
      const totalIters = await runRound();
      values.push((totalIters / ROUND_MS) * 1000);
    }
    return finishResult(
      `cpu-multi`,
      `CPU マルチコア (${cores}並列)`,
      values,
      SCALE.cpuMulti,
      (v) => `${(v / 1e6).toFixed(1)} M ops/s`,
    );
  } catch {
    // Web Worker 不可（CSP 制限等）→ メインスレッド単一計測に退避
    workers.forEach((w) => w.terminate());
    const iters = runCpuFor(ROUND_MS);
    const ops = (iters / ROUND_MS) * 1000;
    const score = Math.round((ops / SCALE.cpuMulti) * 100);
    return {
      key: 'cpu-multi',
      label: 'CPU マルチコア',
      metric: `${(ops / 1e6).toFixed(1)} M ops/s（並列不可の環境）`,
      score,
      rating: ratingFor(score),
      cvPercent: 0,
      available: true,
    };
  } finally {
    workers.forEach((w) => w.terminate());
  }
}

function tierFor(avgScore: number): { label: string; description: string } {
  if (avgScore >= 1000)
    return { label: 'S — 最速級', description: '最新ハイエンド相当の性能です' };
  if (avgScore >= 400)
    return { label: 'A — 高速', description: '上位モデル相当の快適な性能です' };
  if (avgScore >= 150)
    return { label: 'B — 標準', description: '一般的な用途に十分な性能です' };
  if (avgScore >= 50)
    return { label: 'C — エントリー級', description: '軽い用途向けの性能です' };
  return { label: 'D — 控えめ', description: '性能は控えめです（旧世代など）' };
}

function consistencyFor(maxCv: number): BenchOutcome['consistency'] {
  const pct = Math.round(maxCv * 1000) / 10;
  if (maxCv <= 0.08)
    return { level: 'good', label: `安定（ブレ ${pct}%）`, maxCv: pct };
  if (maxCv <= 0.18)
    return { level: 'fair', label: `やや不安定（ブレ ${pct}%）`, maxCv: pct };
  return {
    level: 'poor',
    label: `ブレ大（${pct}%）・再計測推奨`,
    maxCv: pct,
  };
}

export async function runBenchmark(
  onProgress: (p: BenchProgress) => void,
): Promise<BenchOutcome> {
  const steps: Array<{ phase: string; run: () => Promise<BenchResult> }> = [
    { phase: 'CPU シングルコアを計測中…', run: benchCpuSingle },
    { phase: 'CPU マルチコアを計測中…', run: benchCpuMulti },
    { phase: 'メモリ帯域を計測中…', run: benchMemory },
    { phase: 'GPU 描画を計測中…', run: benchGpu },
  ];

  const results: BenchResult[] = [];
  for (let i = 0; i < steps.length; i++) {
    onProgress({ phase: steps[i].phase, ratio: i / steps.length });
    await delay(60); // UI 描画を挟む
    results.push(await steps[i].run());
  }
  onProgress({ phase: '完了', ratio: 1 });

  const total = results.reduce((a, r) => a + r.score, 0);
  const usable = results.filter((r) => r.available);
  const avg = usable.length
    ? usable.reduce((a, r) => a + r.score, 0) / usable.length
    : 0;
  const maxCv = Math.max(
    0,
    ...usable.map((r) => r.cvPercent / 100),
  );

  return {
    results,
    total,
    tier: tierFor(avg),
    consistency: consistencyFor(maxCv),
  };
}
