import { serve } from "@hono/node-server";
import { loadConfig } from "@gatekeeper/core";
import app from "./app.js";

const config = loadConfig();

serve({ fetch: app.fetch, port: config.web.port }, (info) => {
  console.log(`[web] listening on http://localhost:${info.port}`);
});
