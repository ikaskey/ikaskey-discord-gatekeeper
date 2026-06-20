import { defineConfig } from "tsup";

// 本番ビルドは @hono/node-server で listen する server.ts をバンドル
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node24",
  platform: "node",
  clean: true,
  sourcemap: true,
  external: [
    "hono",
    "@hono/node-server",
    "@discordjs/rest",
    "discord-api-types",
    "@gatekeeper/core",
    "@prisma/client",
  ],
});
