import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  createAdminSession,
  deleteAdminSession,
  deleteAllowlist,
  deleteRoleMapping,
  getValidAdminSession,
  listAllowlist,
  listAuditLogs,
  listRoleMappings,
  loadConfig,
  MisskeyClient,
  newMiauthSession,
  TokenInvalidError,
  upsertAllowlist,
  upsertRoleMapping,
  writeAudit,
} from "@gatekeeper/core";
import { brandHeadTags, injectBrand } from "./brand.js";

const config = loadConfig();
const misskey = new MisskeyClient(config.misskey.host);
const SECRET = config.admin.cookieSecret;

const SESSION_COOKIE = "gk_admin";
const AUTH_SESSION_COOKIE = "gk_admin_auth";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  path: "/admin",
} as const;

type AdminCtx = { misskeyId: string; username: string; token: string };

/**
 * 管理画面（M5）の Hono サブアプリ。`/admin` 配下にマウントされる。
 *
 * @remarks
 * 認証は **MiAuth**。`/api/i` の `isModerator` / `isAdministrator` でゲートし、
 * 通過した管理者には署名付き Cookie でセッションを発行する。`/admin/api/*` は
 * セッション必須。`ADMIN_COOKIE_SECRET` 未設定時は全体を 503 で無効化する。
 *
 * 機能（API）:
 * - ロール連動設定（RoleMapping）の一覧/追加更新/削除
 * - 検証除外リスト（Allowlist）の一覧/追加更新/削除
 * - 監査ログ（AuditLog）の閲覧
 * - Misskey 公開ロール一覧（roles/list、連動先選択用）
 *
 * @since 0.4.0
 */
export const adminApp = new Hono<{ Variables: { admin: AdminCtx } }>();

function loginPage(message?: string): string {
  const note = message ? `<p style="color:#f85149">${message}</p>` : "";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>管理ログイン</title>
${brandHeadTags("管理ログイン")}
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100dvh;margin:0;background:#0d1117;color:#e6edf3}
.card{max-width:24rem;padding:2rem;border-radius:1rem;background:#161b22;border:1px solid #30363d;text-align:center}
a.btn{display:inline-block;margin-top:1rem;padding:.6rem 1.2rem;border-radius:.6rem;background:#86b300;color:#0d1117;font-weight:700;text-decoration:none}</style>
</head><body><div class="card"><h1>🦑 管理画面</h1>
<p>いかすきーのモデレーター/管理者のみ利用できます。</p>${note}
<a class="btn" href="/admin/auth/start">いかすきーでログイン</a></div></body></html>`;
}

// ADMIN_COOKIE_SECRET 未設定なら管理画面全体を無効化
adminApp.use("*", async (c, next) => {
  if (!SECRET) return c.text("管理画面は無効です（ADMIN_COOKIE_SECRET 未設定）。", 503);
  await next();
});

/** ログイン開始: MiAuth へリダイレクト */
adminApp.get("/auth/start", async (c) => {
  const session = newMiauthSession();
  await setSignedCookie(c, AUTH_SESSION_COOKIE, session, SECRET, { ...COOKIE_OPTS, maxAge: 600 });
  const callback = `${config.web.publicBaseUrl}/admin/auth/callback`;
  const url = misskey.buildMiauthUrl(session, {
    appName: `${config.misskey.appName}（管理）`,
    callback,
  });
  return c.redirect(url);
});

/** ログインコールバック: トークン確定 → モデレーター/管理者判定 → セッション発行 */
adminApp.get("/auth/callback", async (c) => {
  const expected = await getSignedCookie(c, SECRET, AUTH_SESSION_COOKIE);
  const session = c.req.query("session");
  if (!expected || !session || expected !== session) {
    return c.html(loginPage("セッションが一致しません。もう一度お試しください。"), 400);
  }
  deleteCookie(c, AUTH_SESSION_COOKIE, { path: "/admin" });

  let token: string;
  try {
    const check = await misskey.miauthCheck(session);
    if (!check.ok || !check.token || !check.user) {
      return c.html(loginPage("認証が完了していません。"), 400);
    }
    token = check.token;
    const me = await misskey.getMe(token);
    if (!(me.isModerator || me.isAdministrator)) {
      return c.html(loginPage("権限がありません（モデレーター/管理者のみ）。"), 403);
    }
    const { id } = await createAdminSession({
      misskeyId: me.id,
      username: me.username,
      token,
    });
    await setSignedCookie(c, SESSION_COOKIE, id, SECRET, { ...COOKIE_OPTS, maxAge: 12 * 3600 });
    await writeAudit({
      type: "admin_login",
      summary: `管理ログイン: @${me.username}`,
      actor: me.id,
    });
    return c.redirect("/admin");
  } catch (err) {
    console.error("[admin] auth failed", err);
    return c.html(loginPage("いかすきーとの通信に失敗しました。"), 502);
  }
});

// /api/* はセッション必須
adminApp.use("/api/*", async (c, next) => {
  const id = await getSignedCookie(c, SECRET, SESSION_COOKIE);
  const admin = id ? await getValidAdminSession(id) : null;
  if (!admin) return c.json({ error: "unauthorized" }, 401);
  c.set("admin", admin);
  await next();
});

adminApp.get("/api/me", (c) => {
  const admin = c.get("admin");
  return c.json({ misskeyId: admin.misskeyId, username: admin.username });
});

adminApp.post("/api/logout", async (c) => {
  const id = await getSignedCookie(c, SECRET, SESSION_COOKIE);
  if (id) await deleteAdminSession(id);
  deleteCookie(c, SESSION_COOKIE, { path: "/admin" });
  return c.json({ ok: true });
});

/** Misskey 公開ロール一覧（連動先選択用） */
adminApp.get("/api/roles", async (c) => {
  const admin = c.get("admin");
  try {
    const roles = await misskey.rolesList(admin.token);
    return c.json(roles);
  } catch (err) {
    if (err instanceof TokenInvalidError) return c.json({ error: "token_expired" }, 401);
    console.error("[admin] roles/list failed", err);
    return c.json({ error: "misskey_error" }, 502);
  }
});

// ---- RoleMapping ----
adminApp.get("/api/mappings", async (c) => c.json(await listRoleMappings()));

adminApp.put("/api/mappings", async (c) => {
  const admin = c.get("admin");
  const body = await c.req.json<{
    misskeyRoleId: string;
    misskeyRoleName: string;
    discordRoleId: string;
    enabled?: boolean;
    autoSync?: boolean;
  }>();
  if (!body.misskeyRoleId || !body.discordRoleId) {
    return c.json({ error: "misskeyRoleId と discordRoleId は必須です" }, 400);
  }
  const row = await upsertRoleMapping(body);
  await writeAudit({
    type: "mapping_change",
    summary: `連動設定: ${row.misskeyRoleName} → ${row.discordRoleId}`,
    actor: admin.misskeyId,
  });
  return c.json(row);
});

adminApp.delete("/api/mappings/:misskeyRoleId", async (c) => {
  const admin = c.get("admin");
  const misskeyRoleId = c.req.param("misskeyRoleId");
  await deleteRoleMapping(misskeyRoleId).catch(() => {});
  await writeAudit({
    type: "mapping_change",
    summary: `連動設定を削除: ${misskeyRoleId}`,
    actor: admin.misskeyId,
  });
  return c.json({ ok: true });
});

// ---- Allowlist ----
adminApp.get("/api/allowlist", async (c) => c.json(await listAllowlist()));

adminApp.put("/api/allowlist", async (c) => {
  const admin = c.get("admin");
  const body = await c.req.json<{ discordId: string; reason: string }>();
  if (!body.discordId) return c.json({ error: "discordId は必須です" }, 400);
  const row = await upsertAllowlist(body.discordId, body.reason ?? "");
  await writeAudit({
    type: "allowlist_change",
    summary: `除外追加: ${row.discordId}`,
    actor: admin.misskeyId,
    targetDiscordId: row.discordId,
  });
  return c.json(row);
});

adminApp.delete("/api/allowlist/:discordId", async (c) => {
  const admin = c.get("admin");
  const discordId = c.req.param("discordId");
  await deleteAllowlist(discordId);
  await writeAudit({
    type: "allowlist_change",
    summary: `除外削除: ${discordId}`,
    actor: admin.misskeyId,
    targetDiscordId: discordId,
  });
  return c.json({ ok: true });
});

// ---- AuditLog ----
adminApp.get("/api/audit", async (c) => c.json(await listAuditLogs(200)));

// ---- 管理 UI（SPA）配信 ----
// ビルド済み admin-ui を public/admin から配信（マウント時 c.req.path は /admin/... のままなので
// root=./public で ./public/admin/... に解決される）。未ログインや直リンクは SPA 側で /api/me を見て制御。
adminApp.use("/assets/*", serveStatic({ root: "./public" }));

// SPA の index.html はブランディングタグを注入して配信（差し替え可能なファビコン/OGP）
let cachedSpaIndex: string | null = null;
async function loadSpaIndex(): Promise<string | null> {
  if (cachedSpaIndex !== null) return cachedSpaIndex;
  try {
    const html = await readFile("./public/admin/index.html", "utf8");
    cachedSpaIndex = injectBrand(html);
    return cachedSpaIndex;
  } catch {
    return null;
  }
}
adminApp.get("*", async (c) => {
  const html = await loadSpaIndex();
  return html ? c.html(html) : c.text("管理画面のビルド成果物が見つかりません。", 404);
});
