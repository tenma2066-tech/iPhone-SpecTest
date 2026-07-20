// ベンチマークの計測カーネル。メインスレッドと Web Worker の両方から使う。
// いずれも「一定時間内に処理できた量」を測るスタイルで、端末速度に自動で
// スケールする。最適化で消されないよう結果を必ず返す/使う。

/** CPU 計算カーネル。n 回の数値演算を行い、累積値を返す。 */
export function cpuKernel(n: number): number {
  let acc = 0;
  for (let i = 1; i <= n; i++) {
    acc += Math.sqrt(i * 1.0000001) * Math.sin(i) + Math.cos(acc);
    if (acc > 1e6) acc %= 1000003;
  }
  return acc;
}

/**
 * 指定時間 (ms) の間 cpuKernel を回し続け、実行できた総反復回数を返す。
 * chunk 単位で回して経過時間を確認する。
 */
export function runCpuFor(durationMs: number, chunk = 200_000): number {
  const start = performance.now();
  let total = 0;
  // 結果を捨てないための番人
  let sink = 0;
  while (performance.now() - start < durationMs) {
    sink += cpuKernel(chunk);
    total += chunk;
  }
  if (sink === Number.POSITIVE_INFINITY) console.log(sink);
  return total;
}

/**
 * メモリ帯域カーネル。size 要素の Float64Array に対しコピー＋総和を行い、
 * 指定時間内に処理できたバイト数を返す。
 */
export function runMemoryFor(durationMs: number, size = 1_000_000): number {
  const a = new Float64Array(size);
  const b = new Float64Array(size);
  for (let i = 0; i < size; i++) a[i] = i * 0.5;

  const start = performance.now();
  let bytes = 0;
  let sink = 0;
  while (performance.now() - start < durationMs) {
    // copy
    b.set(a);
    // read + accumulate
    let s = 0;
    for (let i = 0; i < size; i++) s += b[i];
    sink += s;
    // Float64 = 8 bytes、コピー(読+書=2)＋走査(読=1) で 3 アクセス相当
    bytes += size * 8 * 3;
  }
  if (sink === Number.POSITIVE_INFINITY) console.log(sink);
  return bytes;
}
