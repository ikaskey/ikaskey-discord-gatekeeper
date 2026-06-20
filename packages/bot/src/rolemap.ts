import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { deleteRoleMapping, listRoleMappings, upsertRoleMapping } from "@gatekeeper/core";

/**
 * `/rolemap` コマンドのハンドラ（連動設定の一覧/追加更新/削除）。
 *
 * @remarks
 * 応答はすべて本人にのみ見える ephemeral。`set` は `misskey_role_id` をキーに upsert する。
 * 管理画面（M5）が用意されるまでの暫定的な管理手段。
 *
 * @param interaction - `/rolemap` のスラッシュコマンドインタラクション
 *
 * @since 0.3.0
 */
export async function handleRoleMap(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "list") {
    const rows = await listRoleMappings();
    const text =
      rows.length === 0
        ? "連動設定はありません。`/rolemap set` で追加してください。"
        : rows
            .map(
              (r) =>
                `• ${r.misskeyRoleName} (\`${r.misskeyRoleId}\`) → <@&${r.discordRoleId}>` +
                `${r.enabled ? "" : " (無効)"}`,
            )
            .join("\n");
    await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === "set") {
    const misskeyRoleId = interaction.options.getString("misskey_role_id", true);
    const misskeyRoleName = interaction.options.getString("misskey_role_name", true);
    const discordRole = interaction.options.getRole("discord_role", true);
    const enabled = interaction.options.getBoolean("enabled") ?? true;
    await upsertRoleMapping({
      misskeyRoleId,
      misskeyRoleName,
      discordRoleId: discordRole.id,
      enabled,
    });
    await interaction.reply({
      content: `連動を設定しました: ${misskeyRoleName} → <@&${discordRole.id}>${enabled ? "" : "（無効）"}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "remove") {
    const misskeyRoleId = interaction.options.getString("misskey_role_id", true);
    await deleteRoleMapping(misskeyRoleId).catch(() => {
      /* 既に無い場合は無視 */
    });
    await interaction.reply({
      content: `連動を削除しました: \`${misskeyRoleId}\``,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}
