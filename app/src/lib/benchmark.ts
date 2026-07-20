// ベンチマークの司令塔。各テストを順に実行し、スコア化して返す。
// すべて端末内で完結し、外部送信はしない。
import { runCpuFor, runMemoryFor } from './benchKernels';
// Web Worker はビルドに埋め込む（単一ファイル配信でも動くようインライン化）。
import BenchWorker from './bench.worker?worker&inline';

export type BenchResult = {
  key: string;
  label: string;
  /** 生の計測値（例: "12.3 M ops/s"） */
  metric: string;
  /** 正規化スコア（大きいほど速い） */
  score: number;
};

export type BenchProgress = {
  phase: string;
  /** 0〜1 */
  ratio: number;
};

// 各テストの実行時間（ms）。合計 ~3 秒。
const DURATION = 700;

// スコア正規化の係数（体感で扱いやすい数字にするための目安）。
// 実機データが集まったら基準端末に合わせて調整する。
const SCALE = {
  cpuSingle: 1_500_000, // ops/s → score
  cpuMulti: 1_500_000,
  memory: 200 * 1024 * 1024, // bytes/s → score
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function benchCpuSingle(): Promise<BenchResult> {
  // ウォームアップ
  runCpuFor(150);
  await delay(0);
  const iters = runCpuFor(DURATION);
  const opsPerSec = (iters / DURATION) * 1000;
  return {
    key: 'cpu-single',
    label: 'CPU シングルコア',
    metric: `${(opsPerSec / 1e6).toFixed(1)} M ops/s`,
    score: Math.round(opsPerSec / SCALE.cpuSingle * 100),
  };
}

async function benchCpuMulti(): Promise<BenchResult> {
  const cores = navigator.hardwareConcurrency || 2;
  const workers: Worker[] = [];
  try {
    const results = await Promise.all(
      Array.from({ length: cores }, () => {
        const w = new BenchWorker();
        workers.push(w);
        return new Promise<number>((resolve, reject) => {
          w.onerror = (e) => reject(e);
          w.onmessage = (e: MessageEvent<{ iterations: number }>) =>
            resolve(e.data.iterations);
          w.postMessage({ durationMs: DURATION });
        });
      }),
    );
    const totalIters = results.reduce((a, b) => a + b, 0);
    const opsPerSec = (totalIters / DURATION) * 1000;
    return {
      key: 'cpu-multi',
      label: `CPU マルチコア (${cores}並列)`,
      metric: `${(opsPerSec / 1e6).toFixed(1)} M ops/s`,
      score: Math.round((opsPerSec / SCALE.cpuMulti) * 100),
    };
  } catch {
    // Web Worker が使えない環境（CSP 制限など）ではメインスレッドで単一計測に退避
    workers.forEach((w) => w.terminate());
    const iters = runCpuFor(DURATION);
    const opsPerSec = (iters / DURATION) * 1000;
    return {
      key: 'cpu-multi',
      label: 'CPU マルチコア',
      metric: `${(opsPerSec / 1e6).toFixed(1)} M ops/s（並列不可の環境）`,
      score: Math.round((opsPerSec / SCALE.cpuMulti) * 100),
    };
  } finally {
    workers.forEach((w) => w.terminate());
  }
}

async function benchMemory(): Promise<BenchResult> {
  await delay(0);
  const bytes = runMemoryFor(DURATION);
  const bytesPerSec = (bytes / DURATION) * 1000;
  return {
    key: 'memory',
    label: 'メモリ帯域',
    metric: `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)} GB/s`,
    score: Math.round((bytesPerSec / SCALE.memory) * 100),
  };
}

export async function runBenchmark(
  onProgress: (p: BenchProgress) => void,
): Promise<{ results: BenchResult[]; total: number }> {
  const steps: Array<{ phase: string; run: () => Promise<BenchResult> }> = [
    { phase: 'CPU シングルコアを計測中…', run: benchCpuSingle },
    { phase: 'CPU マルチコアを計測中…', run: benchCpuMulti },
    { phase: 'メモリ帯域を計測中…', run: benchMemory },
  ];

  const results: BenchResult[] = [];
  for (let i = 0; i < steps.length; i++) {
    onProgress({ phase: steps[i].phase, ratio: i / steps.length });
    // UI を描画させてから重い処理へ
    await delay(50);
    results.push(await steps[i].run());
  }
  onProgress({ phase: '完了', ratio: 1 });

  const total = results.reduce((a, r) => a + r.score, 0);
  return { results, total };
}
