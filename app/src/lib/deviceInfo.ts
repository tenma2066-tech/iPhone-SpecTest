// iOS Safari を主対象にした端末情報の収集モジュール。
// すべてブラウザ内で完結し、外部送信は行わない。
// 取得できない値は null を返し、UI 側で「Webの制限」として明示する。

export type SpecItem = {
  key: string;
  label: string;
  value: string | null;
  /** 値が取れなかった理由（Safari の制限など）。value が null のとき表示する。 */
  note?: string;
};

export type DeviceInfo = {
  isIOS: boolean;
  items: SpecItem[];
};

function getIOSVersion(ua: string): string | null {
  // 例: "OS 17_5_1" → "17.5.1"
  const m = ua.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))?/);
  if (!m) return null;
  return [m[1], m[2], m[3]].filter(Boolean).join('.');
}

function getWebGLRenderer(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const r = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      if (r) return String(r);
    }
    const fallback = gl.getParameter(gl.RENDERER);
    return fallback ? String(fallback) : null;
  } catch {
    return null;
  }
}

async function getStorageEstimate(): Promise<string | null> {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (est.quota) {
        const gb = est.quota / 1024 ** 3;
        return `約 ${gb.toFixed(1)} GB（ブラウザ割当の見積り）`;
      }
    }
  } catch {
    /* noop */
  }
  return null;
}

function supports(feature: boolean): string {
  return feature ? '対応' : '非対応';
}

export async function collectDeviceInfo(): Promise<DeviceInfo> {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS はデスクトップ UA を返すため touch で判定
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const dpr = window.devicePixelRatio || 1;
  const logicalW = window.screen.width;
  const logicalH = window.screen.height;
  const physicalW = Math.round(logicalW * dpr);
  const physicalH = Math.round(logicalH * dpr);

  const iosVersion = getIOSVersion(ua);
  const webgl = getWebGLRenderer();
  const storage = await getStorageEstimate();

  const hasWebGPU = 'gpu' in navigator;
  const hasWebGL = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  })();
  const hasWasm = typeof WebAssembly === 'object';
  const hasMotion =
    typeof (window as unknown as { DeviceMotionEvent?: unknown })
      .DeviceMotionEvent !== 'undefined';

  const items: SpecItem[] = [
    {
      key: 'os',
      label: 'OS バージョン',
      value: iosVersion ? `iOS ${iosVersion}` : null,
      note: 'User-Agent から取得できませんでした',
    },
    {
      key: 'model',
      label: '機種',
      value: null,
      note: 'Safari は正確な機種名を返しません（後日、指紋情報＋DB照合で推定予定）',
    },
    {
      key: 'screen-logical',
      label: '画面（論理解像度）',
      value: `${logicalW} × ${logicalH} pt`,
    },
    {
      key: 'screen-physical',
      label: '画面（物理解像度・推定）',
      value: `${physicalW} × ${physicalH} px`,
    },
    {
      key: 'dpr',
      label: 'ピクセル比 (DPR)',
      value: `${dpr}×`,
    },
    {
      key: 'cores',
      label: 'CPU 論理コア数',
      value:
        typeof navigator.hardwareConcurrency === 'number'
          ? `${navigator.hardwareConcurrency} コア`
          : null,
      note: 'Safari では丸められる場合があります',
    },
    {
      key: 'gpu',
      label: 'GPU',
      value: webgl,
      note: '近年の Safari では "Apple GPU" 等にマスクされます',
    },
    {
      key: 'touch',
      label: '最大タッチ点数',
      value: `${navigator.maxTouchPoints} 点`,
    },
    {
      key: 'storage',
      label: 'ストレージ空き（見積り）',
      value: storage,
      note: '実際の端末容量ではなくブラウザ割当の見積りです',
    },
    {
      key: 'lang',
      label: '言語',
      value: navigator.language || null,
    },
    {
      key: 'tz',
      label: 'タイムゾーン',
      value: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    },
    {
      key: 'features',
      label: '対応機能',
      value: `WebGL:${supports(hasWebGL)} / WebGPU:${supports(
        hasWebGPU,
      )} / WASM:${supports(hasWasm)} / モーション:${supports(hasMotion)}`,
    },
  ];

  return { isIOS, items };
}
