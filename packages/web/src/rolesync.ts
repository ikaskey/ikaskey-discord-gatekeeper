import { computeModAdminRoleSync, loadConfig, MisskeyClient } from "@gatekeeper/core";
import { addGuildMemberRole, getGuildMemberRoleIds, removeGuildMemberRole } from "./discord.js";

const config = loadConfig();
const misskey = new MisskeyClient(config.misskey.host);

/**
 * Misskey のモデレーター/管理者状態に応じて、連動 Discord ロールを差分同期する（M7）。
 *
 * @remarks
 * `MISSKEY_MODERATOR_ROLE_ID` / `MISSKEY_ADMIN_ROLE_ID` のいずれも未設定なら何もしない。
 * `/api/i` でその時点の `isModerator` / `isAdministrator` を確認し、設定された Discord ロールのみ
 * 付与/剥奪する（他のロールには触れない）。失敗しても認証フロー自体は止めない。
 *
 * @param guildId - 対象ギルド ID
 * @param discordId - 対象 Discord ユーザー ID
 * @param token - 対象ユーザーの Misskey アクセストークン
 *
 * @since 0.8.0
 */
export async function syncMisskeyModAdminRoles(
  guildId: string,
  discordId: string,
  token: string,
): Promise<void> {
  const { moderatorRoleId, adminRoleId } = config.misskey;
  if (!moderatorRoleId && !adminRoleId) return;

  try {
    const lvl = await misskey.checkAuthLevel(token);
    const current = new Set(await getGuildMemberRoleIds(guildId, discordId));
    const plan = computeModAdminRoleSync({
      isModerator: lvl.isModerator,
      isAdministrator: lvl.isAdministrator,
      moderatorRoleId,
      adminRoleId,
      currentRoleIds: current,
    });
    for (const roleId of plan.toAdd) {
      await addGuildMemberRole(guildId, discordId, roleId, "Misskeyモデレーター/管理者連動");
    }
    for (const roleId of plan.toRemove) {
      await removeGuildMemberRole(guildId, discordId, roleId, "Misskeyモデレーター/管理者連動");
    }
  } catch (err) {
    console.error("[rolesync] mod/admin sync failed", err);
  }
}
