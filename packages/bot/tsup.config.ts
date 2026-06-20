import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node24",
  platform: "node",
  clean: true,
  sourcemap: true,
  // discord.js / @gatekeeper/core は node_modules から実行時解決（バンドルしない）
  external: ["discord.js", "@gatekeeper/core", "@prisma/client", "node-cron"],
});
