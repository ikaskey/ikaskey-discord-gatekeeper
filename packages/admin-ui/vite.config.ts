import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/**
 * Vite 設定。
 *
 * - `base` は web 配信時のマウントパス `/admin/`。
 * - ビルド出力は web パッケージの公開ディレクトリ `packages/web/public/admin`。
 * - dev 時は管理 API/認証を web サーバ(localhost:3001)へプロキシする。
 *
 * @since 0.4.0
 */
export default defineConfig({
  base: "/admin/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../web/public/admin",
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      "/admin/api": "http://localhost:3001",
      "/admin/auth": "http://localhost:3001",
    },
  },
});
