/**
 * web プロセスのエントリポイント。
 *
 * @remarks
 * `@hono/node-server` の `serve` で {@link app} を設定ポートで listen し、
 * 起動時に待受 URL をログ出力する。
 * @see {@link ./app.ts}
 */
import { serve } from "@hono/node-server";
import { loadConfig } from "@gatekeeper/core";
import app from "./app.js";

const config = loadConfig();

serve({ fetch: app.fetch, port: config.web.port }, (info) => {
  console.log(`[web] listening on http://localhost:${info.port}`);
});
