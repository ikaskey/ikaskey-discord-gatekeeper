/**
 * MiAuth 認証フローの中核となる Hono アプリケーション。
 *
 * @remarks
 * web プロセスは Discord のゲートウェイ接続を持たず、REST のみで動作する。
 * 認証は次の 2 ステップで進む:
 * 1. `/auth/misskey/start` — bot が発行した state(nonce) を検証し、
 *    MiAuth セッションを採番して いかすきー の認可画面へ 302 リダイレクト。
 * 2. `/auth/misskey/callback` — token を確定し、Link を保存(1:1 制約)した上で
 *    会員ロールを REST で付与する。
 *
 * ロール付与には Bot の **Manage Roles** 権限と、Bot ロールを会員ロールより
 * 上位に置くロール階層が必要。
 *
 * @see {@link addGuildMemberRole}
 * @see {@link successPage}
 * @see {@link errorPage}
 */
import { Hono } from "hono";
import {
  attachMiauthSession,
  computeRoleSync,
  consumeState,
  getActiveState,
  listActiveRoleMappings,
  loadConfig,
  MisskeyAlreadyLinkedError,
  MisskeyClient,
  newMiauthSession,
  upsertLink,
  writeAudit,
} from "@gatekeeper/core";
import { adminApp } from "./admin.js";
import { addGuildMemberRole, getGuildMemberRoleIds, removeGuildMemberRole } from "./discord.js";
import { joinApp } from "./join.js";
import { errorPage, successPage } from "./views.js";

const config = loadConfig();
const misskey = new MisskeyClient(config.misskey.host);

/**
 * MiAuth フローと死活監視を提供する Hono アプリケーション。
 *
 * @remarks
 * `server.ts` から `app.fetch` として `@hono/node-server` に渡され listen される。
 * 公開ルートは `/healthz`・`/auth/misskey/start`・`/auth/misskey/callback` の 3 つ。
 * @see {@link ./server.ts}
 * @since 0.1.0
 */
const app = new Hono();

/**
 * ヘルスチェック用エンドポイント。
 *
 * @remarks
 * 常に `{ ok: true }` を JSON で返す。死活監視・ロードバランサのプローブ用。
 */
app.get("/healthz", (c) => c.json({ ok: true }));

// 管理画面（M5）を /admin 配下にマウント
app.route("/admin", adminApp);

// 未参加ユーザーの自動参加フロー（M6）を /join 配下にマウント
app.route("/join", joinApp);

/**
 * GET `/auth/misskey/start` — 認証開始。
 *
 * @remarks
 * クエリ `state`(bot が発行した nonce)を受け取り、有効な state を確認する。
 * 新しい MiAuth セッションを採番して state に紐付け、いかすきー の認可画面へ 302 リダイレクトする。
 * state が欠落・無効・期限切れの場合は {@link errorPage} を 400 で返す。
 */
app.get("/auth/misskey/start", async (c) => {
  const nonce = c.req.query("state");
  if (!nonce) {
    return c.html(errorPage("リンクが不正です。"), 400);
  }
  const st = await getActiveState(nonce);
  if (!st) {
    return c.html(
      errorPage(
        "リンクが無効か、期限切れです。",
        "Discordの認証パネルでもう一度ボタンを押してください。",
      ),
      400,
    );
  }

  const session = newMiauthSession();
  await attachMiauthSession(nonce, session);

  const callback = `${config.web.publicBaseUrl}/auth/misskey/callback?state=${encodeURIComponent(nonce)}`;
  const url = misskey.buildMiauthUrl(session, {
    appName: config.misskey.appName,
    callback,
  });
  return c.redirect(url);
});

/**
 * GET `/auth/misskey/callback` — MiAuth コールバック。
 *
 * @remarks
 * クエリ `state`(nonce)と `session` を検証し、次の順で処理する:
 * 1. `miauthCheck` で token とユーザー情報を確定。未完了・通信失敗なら 400/502。
 * 2. {@link upsertLink} で Link を保存(1:1 制約)。既に別 Discord に連携済みなら 409。
 * 3. {@link addGuildMemberRole} で会員ロールを REST 付与。失敗時は権限/ロール階層案内を 500 で返す。
 *
 * すべて成功すると state を消費し {@link successPage} を返す。
 * @throws {@link upsertLink} が `MisskeyAlreadyLinkedError` 以外のエラーを投げた場合は再 throw する。
 */
app.get("/auth/misskey/callback", async (c) => {
  const nonce = c.req.query("state");
  const session = c.req.query("session");
  if (!nonce || !session) {
    return c.html(errorPage("コールバックのパラメータが不正です。"), 400);
  }

  const st = await getActiveState(nonce);
  if (!st) {
    return c.html(errorPage("セッションが無効か、期限切れです。"), 400);
  }
  if (st.misskeySession !== session) {
    return c.html(errorPage("セッションが一致しません。"), 400);
  }

  // 1) トークン確定
  let token: string;
  let user;
  try {
    const check = await misskey.miauthCheck(session);
    if (!check.ok || !check.token || !check.user) {
      return c.html(
        errorPage(
          "認証がまだ完了していません。",
          "いかすきーで「許可」を押してから戻ってください。",
        ),
        400,
      );
    }
    token = check.token;
    user = check.user;
  } catch (err) {
    console.error("[web] miauthCheck failed", err);
    return c.html(
      errorPage("いかすきーとの通信に失敗しました。", "時間をおいて再度お試しください。"),
      502,
    );
  }

  // 2) Link 保存（1:1 制約）
  try {
    await upsertLink({
      discordId: st.discordId,
      guildId: st.guildId,
      misskeyId: user.id,
      username: user.username,
      misskeyHost: user.host ?? null,
      token,
    });
  } catch (err) {
    if (err instanceof MisskeyAlreadyLinkedError) {
      return c.html(
        errorPage(
          "このいかすきーアカウントは既に別のDiscordアカウントに連携済みです。",
          "連携を移したい場合は管理者にお問い合わせください。",
        ),
        409,
      );
    }
    throw err;
  }

  // 3) 会員ロール付与（REST）
  try {
    await addGuildMemberRole(
      st.guildId,
      st.discordId,
      config.discord.verifiedRoleId,
      `いかすきー認証完了: @${user.username}`,
    );
  } catch (err) {
    console.error("[web] role grant failed", err);
    return c.html(
      errorPage(
        "ロールの付与に失敗しました。",
        "Botの権限（Manage Roles）とロール順（Botロールを会員ロールより上に）を確認してください。",
      ),
      500,
    );
  }

  // 4) Misskeyロール → Discordロール の即時連動（M4）。失敗しても認証自体は成功扱い。
  try {
    const mappings = await listActiveRoleMappings();
    if (mappings.length > 0) {
      const misskeyRoleIds = new Set((user.roles ?? []).map((r) => r.id));
      const current = new Set(await getGuildMemberRoleIds(st.guildId, st.discordId));
      const plan = computeRoleSync(misskeyRoleIds, mappings, current);
      for (const roleId of plan.toAdd) {
        await addGuildMemberRole(st.guildId, st.discordId, roleId, "Misskeyロール連動");
      }
      for (const roleId of plan.toRemove) {
        await removeGuildMemberRole(st.guildId, st.discordId, roleId, "Misskeyロール連動");
      }
    }
  } catch (err) {
    console.error("[web] role sync failed", err);
  }

  await consumeState(nonce);
  await writeAudit({
    type: "auth",
    summary: `認証完了: @${user.username}`,
    targetDiscordId: st.discordId,
  }).catch(() => {});
  return c.html(successPage(user.username));
});

/**
 * MiAuth フローを提供する Hono アプリのデフォルトエクスポート。
 *
 * @remarks
 * `server.ts` で `app.fetch` として `@hono/node-server` の `serve` に渡される。
 * @example
 * ```ts
 * import app from "./app.js";
 * serve({ fetch: app.fetch, port });
 * ```
 * @since 0.1.0
 */
export default app;
