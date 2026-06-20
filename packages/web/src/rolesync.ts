import {
  computeModAdminRoleSync,
  computeRoleSync,
  listActiveRoleMappings,
  loadConfig,
  MisskeyClient,
} from "@gatekeeper/core";
import { addGuildMemberRole, getGuildMemberRoleIds, removeGuildMemberRole } from "./discord.js";

const config = loadConfig();
const misskey = new MisskeyClient(config.misskey.host);

/**
 * 認証/自動参加の完了時に、対象メンバーの Discord ロールを一括で差分同期する（M4＋M7）。
 *
 * @remarks
 * `/api/i` を **1 回だけ**呼んで、その時点の公開ロール・モデレーター/管理者を取得し、
 * 次の 2 つを 1 回の差分適用にまとめる:
 * - **M4**: Misskey ロール（manual / conditional）→ {@link @gatekeeper/core#listActiveRoleMappings | 連動設定}に基づく Discord ロール。
 * - **M7**: Misskey モデレーター/管理者 → `MISSKEY_MODERATOR_ROLE_ID` / `MISSKEY_ADMIN_ROLE_ID`。
 *
 * 現在のロールは 1 回だけ取得し、付与/剥奪が衝突する場合は付与を優先する（剥奪しない）。
 * トークンが無効なら何もしない（ロールを誤って剥奪しない）。失敗しても認証フロー自体は止めない。
 *
 * @param guildId - 対象ギルド ID
 * @param discordId - 対象 Discord ユーザー ID
 * @param token - 対象ユーザーの Misskey アクセストークン
 * @since 0.9.0
 */
export async function syncMemberRoles(
  guildId: string,
  discordId: string,
  token: string,
): Promise<void> {
  try {
    const lvl = await misskey.checkAuthLevel(token);
    if (!lvl.exists) return; // トークン失効時は誤剥奪を避けて何もしない

    const { moderatorRoleId, adminRoleId } = config.misskey;
    const mappings = await listActiveRoleMappings();
    if (mappings.length === 0 && !moderatorRoleId && !adminRoleId) return;

    const current = new Set(await getGuildMemberRoleIds(guildId, discordId));
    const toAdd = new Set<string>();
    const toRemove = new Set<string>();

    if (mappings.length > 0) {
      const plan = computeRoleSync(new Set(lvl.roleIds), mappings, current);
      for (const r of plan.toAdd) toAdd.add(r);
      for (const r of plan.toRemove) toRemove.add(r);
    }
    if (moderatorRoleId || adminRoleId) {
      const plan = computeModAdminRoleSync({
        isModerator: lvl.isModerator,
        isAdministrator: lvl.isAdministrator,
        moderatorRoleId,
        adminRoleId,
        currentRoleIds: current,
      });
      for (const r of plan.toAdd) toAdd.add(r);
      for (const r of plan.toRemove) toRemove.add(r);
    }

    for (const roleId of toAdd) {
      if (toRemove.has(roleId)) continue;
      await addGuildMemberRole(guildId, discordId, roleId, "Misskey連動");
    }
    for (const roleId of toRemove) {
      await removeGuildMemberRole(guildId, discordId, roleId, "Misskey連動");
    }
  } catch (err) {
    console.error("[rolesync] member role sync failed", err);
  }
}
