import { Hono } from 'hono';
import {
  MisskeyAlreadyLinkedError,
  MisskeyClient,
  attachMiauthSession,
  consumeState,
  getActiveState,
  loadConfig,
  newMiauthSession,
  upsertLink,
} from '@gatekeeper/core';
import { addGuildMemberRole } from './discord.js';
import { errorPage, successPage } from './views.js';

const config = loadConfig();
const misskey = new MisskeyClient(config.misskey.host);

const app = new Hono();

app.get('/healthz', (c) => c.json({ ok: true }));

/**
 * 認証開始: bot が発行した state(nonce) を受け取り、
 * MiAuth セッションを採番して いかすきー の認可画面へリダイレクト。
 */
app.get('/auth/misskey/start', async (c) => {
  const nonce = c.req.query('state');
  if (!nonce) {
    return c.html(errorPage('リンクが不正です。'), 400);
  }
  const st = await getActiveState(nonce);
  if (!st) {
    return c.html(
      errorPage(
        'リンクが無効か、期限切れです。',
        'Discordの認証パネルでもう一度ボタンを押してください。',
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
 * MiAuth コールバック: トークンを確定し、Link を保存して会員ロールを付与。
 */
app.get('/auth/misskey/callback', async (c) => {
  const nonce = c.req.query('state');
  const session = c.req.query('session');
  if (!nonce || !session) {
    return c.html(errorPage('コールバックのパラメータが不正です。'), 400);
  }

  const st = await getActiveState(nonce);
  if (!st) {
    return c.html(errorPage('セッションが無効か、期限切れです。'), 400);
  }
  if (st.misskeySession !== session) {
    return c.html(errorPage('セッションが一致しません。'), 400);
  }

  // 1) トークン確定
  let token: string;
  let user;
  try {
    const check = await misskey.miauthCheck(session);
    if (!check.ok || !check.token || !check.user) {
      return c.html(
        errorPage('認証がまだ完了していません。', 'いかすきーで「許可」を押してから戻ってください。'),
        400,
      );
    }
    token = check.token;
    user = check.user;
  } catch (err) {
    console.error('[web] miauthCheck failed', err);
    return c.html(errorPage('いかすきーとの通信に失敗しました。', '時間をおいて再度お試しください。'), 502);
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
          'このいかすきーアカウントは既に別のDiscordアカウントに連携済みです。',
          '連携を移したい場合は管理者にお問い合わせください。',
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
    console.error('[web] role grant failed', err);
    return c.html(
      errorPage(
        'ロールの付与に失敗しました。',
        'Botの権限（Manage Roles）とロール順（Botロールを会員ロールより上に）を確認してください。',
      ),
      500,
    );
  }

  await consumeState(nonce);
  return c.html(successPage(user.username));
});

export default app;
