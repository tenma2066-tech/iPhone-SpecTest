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

/**
 * GPU 計測ランナー。フラグメントシェーダに重いループを持たせたフルスクリーン
 * 描画を繰り返し、毎回 readPixels で GPU 同期を強制して「1秒あたりの描画パス数」
 * を測る。vsync に縛られず GPU のフラグメント処理性能の目安になる。
 * WebGL が使えない環境では例外を投げる。
 */
export type GpuRunner = {
  run(durationMs: number): number;
  dispose(): void;
};

export function createGpuRunner(): GpuRunner {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const gl = (canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (!gl) throw new Error('WebGL 非対応');

  const vsSrc = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const fsSrc = `
    precision highp float;
    uniform float u;
    void main() {
      vec2 c = gl_FragCoord.xy / 512.0;
      float s = 0.0;
      for (int i = 0; i < 128; i++) {
        float f = float(i);
        s += sin(c.x * f + u) * cos(c.y * f - u);
      }
      gl_FragColor = vec4(fract(s), fract(s * 2.0), fract(s * 3.0), 1.0);
    }`;

  function compile(type: number, src: string): WebGLShader {
    const sh = gl!.createShader(type)!;
    gl!.shaderSource(sh, src);
    gl!.compileShader(sh);
    if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
      throw new Error('shader compile failed: ' + gl!.getShaderInfoLog(sh));
    }
    return sh;
  }

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program link failed');
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  // フルスクリーン2三角形
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const pLoc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(pLoc);
  gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
  const uLoc = gl.getUniformLocation(prog, 'u');

  gl.viewport(0, 0, 512, 512);

  return {
    run(durationMs: number): number {
      const start = performance.now();
      let passes = 0;
      const px = new Uint8Array(4);
      while (performance.now() - start < durationMs) {
        gl.uniform1f(uLoc, passes * 0.017);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        // 1px 読み出しで GPU 同期を強制（描画完了を待たせる）
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        passes++;
      }
      return passes;
    },
    dispose() {
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    },
  };
}
