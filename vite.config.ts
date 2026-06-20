import { defineConfig } from "vite-plus";

// Vite+ のルート設定（vp fmt / vp lint / vp test が参照）。
// lint ルールは .oxlintrc.json 側で定義。
export default defineConfig({
  fmt: {
    // pnpm が管理する lockfile・生成物・マイグレーション・ビルド成果物は整形しない
    ignorePatterns: [
      "**/dist/**",
      "**/generated/**",
      "**/migrations/**",
      "pnpm-lock.yaml",
      "**/*.db",
    ],
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
