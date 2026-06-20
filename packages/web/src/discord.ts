/**
 * Discord REST 操作モジュール。
 *
 * @remarks
 * web プロセスは Discord のゲートウェイ(WebSocket)接続を必要とせず、
 * REST API のみでロール付与/剥奪/キックを行う。
 * いずれの操作も Bot に **Manage Roles**（キックは **Kick Members**）権限と、
 * 対象ロールより上位の Bot ロール順が必要となる。
 *
 * @see {@link https://discord.com/developers/docs/topics/permissions | Discord Permissions}
 */
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { loadConfig } from "@gatekeeper/core";

// web はゲートウェイ不要。REST のみで ロール付与/剥奪/キック を行う。
const config = loadConfig();
const rest = new REST({ version: "10" }).setToken(config.discord.token);

/**
 * 指定ギルドのメンバーにロールを付与する。
 *
 * @param guildId - 対象ギルド(サーバー)の ID
 * @param userId - ロールを付与する Discord ユーザーの ID
 * @param roleId - 付与するロールの ID
 * @param reason - 監査ログに記録される理由(X-Audit-Log-Reason)
 * @returns Discord REST API のレスポンス(本文なしのため未型付け)
 * @throws Discord REST API が失敗した場合(権限不足・ロール階層・対象不在など)に reject する。
 * @remarks
 * Bot は **Manage Roles** 権限を持ち、かつ Bot 自身のロールが付与対象ロールより
 * 上位に並んでいる必要がある。
 * @example
 * ```ts
 * await addGuildMemberRole(guildId, discordId, verifiedRoleId, "いかすきー認証完了");
 * ```
 * @see {@link removeGuildMemberRole}
 * @since 0.1.0
 */
export function addGuildMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
  reason: string,
): Promise<unknown> {
  return rest.put(Routes.guildMemberRole(guildId, userId, roleId), { reason });
}

/**
 * 指定ギルドのメンバーからロールを剥奪する。
 *
 * @param guildId - 対象ギルド(サーバー)の ID
 * @param userId - ロールを剥奪する Discord ユーザーの ID
 * @param roleId - 剥奪するロールの ID
 * @param reason - 監査ログに記録される理由(X-Audit-Log-Reason)
 * @returns Discord REST API のレスポンス(本文なしのため未型付け)
 * @throws Discord REST API が失敗した場合(権限不足・ロール階層・対象不在など)に reject する。
 * @remarks
 * 付与と同様に **Manage Roles** 権限とロール階層の制約を満たす必要がある。
 * 連携解除や認証取り消し時の会員ロール撤回に用いる。
 * @see {@link addGuildMemberRole}
 * @since 0.1.0
 */
export function removeGuildMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
  reason: string,
): Promise<unknown> {
  return rest.delete(Routes.guildMemberRole(guildId, userId, roleId), { reason });
}

/**
 * 指定ギルドからメンバーをキック(追放)する。
 *
 * @param guildId - 対象ギルド(サーバー)の ID
 * @param userId - キックする Discord ユーザーの ID
 * @param reason - 監査ログに記録される理由(X-Audit-Log-Reason)
 * @returns Discord REST API のレスポンス(本文なしのため未型付け)
 * @throws Discord REST API が失敗した場合(権限不足・対象不在など)に reject する。
 * @remarks
 * Bot に **Kick Members** 権限が必要。キックされたユーザーは再招待により復帰可能。
 * @since 0.1.0
 */
export function kickGuildMember(guildId: string, userId: string, reason: string): Promise<unknown> {
  return rest.delete(Routes.guildMember(guildId, userId), { reason });
}

/**
 * 指定ギルドのメンバーが現在保有する Discord ロール ID を取得する。
 *
 * @remarks
 * ロール差分同期（M4）で現在のロール集合を得るために使う。REST `GET guildMember` の
 * `roles` フィールドを返す。
 *
 * @param guildId - 対象ギルド(サーバー)の ID
 * @param userId - 対象 Discord ユーザーの ID
 * @returns メンバーが保有するロール ID の配列
 * @throws Discord REST API が失敗した場合（対象不在など）に reject する。
 * @since 0.3.0
 */
export async function getGuildMemberRoleIds(guildId: string, userId: string): Promise<string[]> {
  const member = (await rest.get(Routes.guildMember(guildId, userId))) as { roles: string[] };
  return member.roles;
}

/**
 * Discord OAuth2 認可コードをアクセストークンに交換する（自動参加 M6）。
 *
 * @param code - OAuth2 コールバックで受け取った `code`
 * @param redirectUri - 認可時と同一の redirect_uri
 * @returns ユーザーのアクセストークン
 * @throws トークン交換に失敗した場合
 * @since 0.7.0
 */
export async function exchangeDiscordCode(code: string, redirectUri: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`discord token exchange failed: ${res.status}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/**
 * ユーザーのアクセストークンで Discord ユーザー情報を取得する。
 *
 * @param accessToken - OAuth2 アクセストークン
 * @returns Discord ユーザーの `id` と `username`
 * @throws 取得に失敗した場合
 * @since 0.7.0
 */
export async function getDiscordUser(
  accessToken: string,
): Promise<{ id: string; username: string }> {
  const res = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`discord users/@me failed: ${res.status}`);
  }
  return (await res.json()) as { id: string; username: string };
}

/**
 * ユーザーをギルドへ追加する（`guilds.join`）。未参加ユーザーの自動参加(M6)に使う。
 *
 * @remarks
 * Bot トークンで `PUT guildMember` を呼び、本人の OAuth2 アクセストークンと初期ロールを渡す。
 * Bot は **Create Instant Invite** 権限が必要。既に参加済みなら 204（no-op）。初期ロールも付与できる。
 *
 * @param guildId - 対象ギルド ID
 * @param userId - 追加する Discord ユーザー ID
 * @param accessToken - 本人の OAuth2 アクセストークン（`guilds.join` スコープ）
 * @param roles - 参加時に付与するロール ID の配列
 * @throws 追加に失敗した場合（権限不足など）
 * @since 0.7.0
 */
export function addGuildMember(
  guildId: string,
  userId: string,
  accessToken: string,
  roles: string[],
): Promise<unknown> {
  return rest.put(Routes.guildMember(guildId, userId), {
    body: { access_token: accessToken, roles },
  });
}
