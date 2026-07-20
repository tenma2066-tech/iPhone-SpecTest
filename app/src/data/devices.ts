// iPhone 機種推定用の内蔵スペックDB。
// Safari は正確な機種名を返さないため、画面の物理解像度・DPR・CPU論理コア数
// などの「指紋」を照合して候補を絞り込む。
//
// physicalW/H は縦持ち時の物理ピクセル（論理pt × DPR）。
// 同一解像度で複数機種が該当する場合は candidates として全て返す。

export type DeviceSpec = {
  name: string;
  /** 縦持ちの物理解像度（px） */
  physicalW: number;
  physicalH: number;
  dpr: number;
  /** CPU 論理コア数（既知の値。判別の補助に使う） */
  cores?: number;
  chip: string;
  releaseYear: number;
};

// 物理解像度(縦持ち) × DPR ごとに 1 エントリ。同解像度の機種はまとめて名前に列挙。
export const DEVICES: DeviceSpec[] = [
  // --- DPR 3・Dynamic Island 世代 ---
  { name: 'iPhone 16 Pro Max', physicalW: 1320, physicalH: 2868, dpr: 3, cores: 6, chip: 'A18 Pro', releaseYear: 2024 },
  { name: 'iPhone 16 Pro', physicalW: 1206, physicalH: 2622, dpr: 3, cores: 6, chip: 'A18 Pro', releaseYear: 2024 },
  { name: 'iPhone 16 Plus / 15 Pro Max / 15 Plus / 14 Pro Max', physicalW: 1290, physicalH: 2796, dpr: 3, cores: 6, chip: 'A18 / A17 Pro / A16 / A16', releaseYear: 2022 },
  { name: 'iPhone 16 / 15 Pro / 15 / 14 Pro', physicalW: 1179, physicalH: 2556, dpr: 3, cores: 6, chip: 'A18 / A17 Pro / A16 / A16', releaseYear: 2022 },

  // --- DPR 3・Pro Max/Plus (旧6.7") ---
  { name: 'iPhone 14 Plus / 13 Pro Max / 12 Pro Max', physicalW: 1284, physicalH: 2778, dpr: 3, cores: 6, chip: 'A15 / A15 / A14', releaseYear: 2020 },

  // --- DPR 3・標準6.1" ---
  { name: 'iPhone 14 / 13 Pro / 13 / 12 Pro / 12', physicalW: 1170, physicalH: 2532, dpr: 3, cores: 6, chip: 'A15 / A15 / A15 / A14 / A14', releaseYear: 2020 },

  // --- DPR 3・mini 5.4" ---
  { name: 'iPhone 13 mini / 12 mini', physicalW: 1080, physicalH: 2340, dpr: 3, cores: 6, chip: 'A15 / A14', releaseYear: 2020 },

  // --- DPR 3・旧Pro Max 6.5" ---
  { name: 'iPhone 11 Pro Max / XS Max', physicalW: 1242, physicalH: 2688, dpr: 3, cores: 6, chip: 'A13 / A12', releaseYear: 2018 },

  // --- DPR 3・ノッチ5.8" ---
  { name: 'iPhone 11 Pro / XS / X', physicalW: 1125, physicalH: 2436, dpr: 3, cores: 6, chip: 'A13 / A12 / A11', releaseYear: 2017 },

  // --- DPR 2・XR/11 6.1" ---
  { name: 'iPhone 11 / XR', physicalW: 828, physicalH: 1792, dpr: 2, cores: 6, chip: 'A13 / A12', releaseYear: 2018 },

  // --- DPR 3・Plus (Home ボタン) ---
  { name: 'iPhone 8 Plus / 7 Plus / 6s Plus', physicalW: 1080, physicalH: 1920, dpr: 3, cores: 6, chip: 'A11 / A10 / A9', releaseYear: 2015 },

  // --- DPR 2・4.7" (Home ボタン) ---
  { name: 'iPhone SE (2/3世代) / 8 / 7 / 6s / 6', physicalW: 750, physicalH: 1334, dpr: 2, cores: 6, chip: 'A15 / A13 / A11 / A9', releaseYear: 2014 },

  // --- DPR 2・4" ---
  { name: 'iPhone SE (第1世代) / 5s / 5', physicalW: 640, physicalH: 1136, dpr: 2, cores: 2, chip: 'A9 / A7 / A6', releaseYear: 2013 },
];

export type GuessResult = {
  /** 該当候補（0件なら未判定） */
  candidates: DeviceSpec[];
  /** 一致に使った物理解像度 */
  matchedResolution: string;
};

/**
 * 物理解像度と DPR から機種候補を推定する。
 * 縦横どちらの向きでも一致するよう、幅・高さは大小で比較する。
 */
export function guessDevice(
  physicalW: number,
  physicalH: number,
  dpr: number,
): GuessResult {
  const min = Math.min(physicalW, physicalH);
  const max = Math.max(physicalW, physicalH);

  const candidates = DEVICES.filter((d) => {
    const dMin = Math.min(d.physicalW, d.physicalH);
    const dMax = Math.max(d.physicalW, d.physicalH);
    // 解像度は数pxの丸め差を許容
    const wOk = Math.abs(dMin - min) <= 2;
    const hOk = Math.abs(dMax - max) <= 2;
    return wOk && hOk && d.dpr === dpr;
  });

  return { candidates, matchedResolution: `${min} × ${max} px` };
}
