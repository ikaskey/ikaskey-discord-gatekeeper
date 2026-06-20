import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import {
  attachMiauthSession,
  computeRoleSync,
  consumeState,
  createVerificationState,
  generateNonce,
  getActiveState,
  listActiveRoleMappings,
  loadConfig,
  MisskeyAlreadyLinkedError,
  MisskeyClient,
  newMiauthSession,
  upsertLink,
  writeAudit,
} from "@gatekeeper/core";
import {
  addGuildMember,
  addGuildMemberRole,
  exchangeDiscordCode,
  getDiscordUser,
  getGuildMemberRoleIds,
  removeGuildMemberRole,
} from "./discord.js";
import { brandHeadTags } from "./brand.js";
import { syncMisskeyModAdminRoles } from "./rolesync.js";
import { errorPage, successPage } from "./views.js";

const config = loadConfig();
const misskey = new MisskeyClient(config.misskey.host);
const SECRET = config.admin.cookieSecret;
const OAUTH_COOKIE = "gk_join_oauth";
const DISCORD_CALLBACK = `${config.web.publicBaseUrl}/join/discord/callback`;

/** 自動参加が有効か（Client Secret と Cookie 署名鍵の両方が必要） */
const enabled = (): boolean => Boolean(config.discord.clientSecret && SECRET);

/**
 * 未参加ユーザーの自動参加フロー（M6）を提供する Hono サブアプリ。`/join` 配下にマウントされる。
 *
 * @remarks
 * Discord にまだ参加していない Misskey ユーザーが、認証ページから **そのままサーバーへ参加**できる:
 * 1. `/join` → Discord OAuth2(identify + guilds.join) でユーザー特定＋参加許可トークン取得
 * 2. いかすきー MiAuth で Misskey アカウント確認
 * 3. `guilds.join` でサーバーへ追加し、会員ロール（＋連動ロール）を付与
 *
 * `DISCORD_CLIENT_SECRET` と `ADMIN_COOKIE_SECRET` の両方が未設定なら無効（503）。
 *
 * @since 0.7.0
 */
export const joinApp = new Hono();

function landingPage(): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" /><title>サーバーに参加</title>
${brandHeadTags("サーバーに参加")}
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100dvh;margin:0;background:#0d1117;color:#e6edf3}
.card{max-width:26rem;padding:2rem;border-radius:1rem;background:#161b22;border:1px solid #30363d;text-align:center}
a.btn{display:inline-block;margin-top:1rem;padding:.7rem 1.4rem;border-radius:.6rem;background:#86b300;color:#0d1117;font-weight:700;text-decoration:none}
p{line-height:1.7;color:#aeb8c2}</style></head>
<body><div class="card"><h1>🦑 会員制Discordに参加</h1>
<p>Misskeyアカウントで認証すると、Discordサーバーへ自動で参加できます。<br />
「Discordで続ける」を押すと、Discordログイン → Misskey認証 の順に進みます。</p>
<a class="btn" href="/join/discord/start">Discordで続ける</a></div></body></html>`;
}

// 自動参加が無効なら全体を 503
joinApp.use("*", async (c, next) => {
  if (!enabled()) {
    return c.html(
      errorPage(
        "自動参加は現在無効です。",
        "管理者向け: DISCORD_CLIENT_SECRET と ADMIN_COOKIE_SECRET を設定してください。",
      ),
      503,
    );
  }
  await next();
});

/** ランディング */
joinApp.get("/", (c) => c.html(landingPage()));

/** Discord OAuth2 開始 */
joinApp.get("/discord/start", async (c) => {
  const nonce = generateNonce();
  await setSignedCookie(c, OAUTH_COOKIE, nonce, SECRET, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/join",
    maxAge: 600,
  });
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", config.discord.clientId);
  url.searchParams.set("redirect_uri", DISCORD_CALLBACK);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds.join");
  url.searchParams.set("state", nonce);
  return c.redirect(url.toString());
});

/** Discord OAuth2 コールバック → トークン交換 → MiAuth へ */
joinApp.get("/discord/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expected = await getSignedCookie(c, SECRET, OAUTH_COOKIE);
  deleteCookie(c, OAUTH_COOKIE, { path: "/join" });
  if (!code || !state || !expected || state !== expected) {
    return c.html(
      errorPage("Discord認証のセッションが不正です。最初からやり直してください。"),
      400,
    );
  }

  let discordUser: { id: string; username: string };
  let accessToken: string;
  try {
    accessToken = await exchangeDiscordCode(code, DISCORD_CALLBACK);
    discordUser = await getDiscordUser(accessToken);
  } catch (err) {
    console.error("[join] discord oauth failed", err);
    return c.html(
      errorPage("Discordとの通信に失敗しました。", "時間をおいて再度お試しください。"),
      502,
    );
  }

  // 認証 state を発行（Discord アクセストークンを保持）し、MiAuth へ
  const nonce = await createJoinState(discordUser.id, accessToken);
  const session = newMiauthSession();
  await attachMiauthSession(nonce, session);
  const callback = `${config.web.publicBaseUrl}/join/misskey/callback?state=${encodeURIComponent(nonce)}`;
  const miauthUrl = misskey.buildMiauthUrl(session, {
    appName: config.misskey.appName,
    callback,
  });
  return c.redirect(miauthUrl);
});

/** MiAuth コールバック → Misskey 確認 → guilds.join ＋ ロール付与 */
joinApp.get("/misskey/callback", async (c) => {
  const nonce = c.req.query("state");
  const session = c.req.query("session");
  if (!nonce || !session) {
    return c.html(errorPage("コールバックのパラメータが不正です。"), 400);
  }
  const st = await getActiveState(nonce);
  if (!st || st.misskeySession !== session || !st.discordAccessToken) {
    return c.html(errorPage("セッションが無効か、期限切れです。"), 400);
  }

  // 1) Misskey トークン確定
  let token: string;
  let user;
  try {
    const check = await misskey.miauthCheck(session);
    if (!check.ok || !check.token || !check.user) {
      return c.html(errorPage("認証がまだ完了していません。"), 400);
    }
    token = check.token;
    user = check.user;
  } catch (err) {
    console.error("[join] miauthCheck failed", err);
    return c.html(errorPage("いかすきーとの通信に失敗しました。"), 502);
  }

  // 2) Link 保存（1:1）
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
        errorPage("このいかすきーアカウントは既に別のDiscordアカウントに連携済みです。"),
        409,
      );
    }
    throw err;
  }

  // 3) サーバーへ自動参加（会員ロール付与）
  try {
    await addGuildMember(st.guildId, st.discordId, st.discordAccessToken, [
      config.discord.verifiedRoleId,
    ]);
  } catch (err) {
    console.error("[join] guilds.join failed", err);
    return c.html(
      errorPage("サーバーへの参加に失敗しました。", "Botの権限（招待を作成）を確認してください。"),
      500,
    );
  }

  // 4) ロール連動（任意）
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
    console.error("[join] role sync failed", err);
  }

  // Misskeyモデレーター/管理者 → Discordロール連動（M7）
  await syncMisskeyModAdminRoles(st.guildId, st.discordId, token);

  await consumeState(nonce);
  await writeAudit({
    type: "auto_join",
    summary: `自動参加＋認証: @${user.username}`,
    targetDiscordId: st.discordId,
  }).catch(() => {});
  return c.html(successPage(user.username));
});

/** Discord OAuth で特定したユーザーの認証 state を発行（アクセストークン保持） */
function createJoinState(discordId: string, accessToken: string): Promise<string> {
  return createVerificationState({
    discordId,
    guildId: config.discord.guildId,
    discordAccessToken: accessToken,
  });
}
