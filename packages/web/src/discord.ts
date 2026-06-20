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
