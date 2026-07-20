# iPhone SpecTest（app）

iPhone のスペック表示と性能ベンチマークを行う Web アプリ（PWA）。
Safari で開くだけで使え、ホーム画面に追加すればアプリのように起動できる。

## 機能

- **スペック表示** — OS・画面解像度・DPR・CPUコア数・GPU・ストレージ見積り等をブラウザ API から取得。取得できない値は「取得不可」と理由を明示。
- **機種推定** — 物理解像度 × DPR を内蔵DB（`src/data/devices.ts`）と照合し、機種名・チップ・発売年を推定。
- **性能ベンチマーク** — CPU シングル/マルチ（Web Workers）・メモリ帯域を実測してスコア化。

すべて端末内で完結し、情報は外部に送信されない。

## 開発

```bash
npm install
npm run dev -- --host   # 実機の Safari から LAN 経由で開く
npm run build           # 本番ビルド（dist/）
npm run preview         # ビルド結果をローカル確認
```

## 技術

Vite + React + TypeScript / Web Workers / vite-plugin-pwa

## 構成

```
src/
  App.tsx              画面
  lib/
    deviceInfo.ts      端末情報の収集＋機種推定の組み立て
    benchmark.ts       ベンチマークの司令塔
    benchKernels.ts    CPU/メモリ計測カーネル（メイン/ワーカー共通）
    bench.worker.ts    マルチコア計測用 Web Worker
  data/
    devices.ts         iPhone 機種スペックDB
```
