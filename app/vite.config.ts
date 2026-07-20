import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// ビルドモード:
// - ARTIFACT=1 : 全アセットを1つの HTML に埋め込む単一ファイル配信（PWA なし）。
// - PAGES_BASE : GitHub Pages のサブパス配信用 base。
// - それ以外   : 通常配信（base '/'、PWA あり）。
const singleFile = process.env.ARTIFACT === '1'
const base = singleFile ? './' : process.env.PAGES_BASE || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    ...(singleFile
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'iPhone SpecTest',
              short_name: 'SpecTest',
              description: 'iPhone のスペック表示と性能ベンチマークを行うアプリ',
              theme_color: '#0a84ff',
              background_color: '#000000',
              display: 'standalone',
              orientation: 'portrait',
              lang: 'ja',
              icons: [
                { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
                {
                  src: 'maskable-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
          }),
        ]),
  ],
})
