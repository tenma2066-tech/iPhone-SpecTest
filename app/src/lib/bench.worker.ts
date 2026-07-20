// CPU マルチコア計測用の Web Worker。
// メッセージを受けたら指定時間 CPU カーネルを回し、反復回数を返す。
import { runCpuFor } from './benchKernels';

self.onmessage = (e: MessageEvent<{ durationMs: number }>) => {
  const iterations = runCpuFor(e.data.durationMs);
  (self as unknown as Worker).postMessage({ iterations });
};
