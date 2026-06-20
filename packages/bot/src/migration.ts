import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { listActiveLinks, listAllowlist, loadConfig } from "@gatekeeper/core";

const config = loadConfig();

/**
 * `/migration-status` コマンドのハンドラ。段階移行の進捗（認証済み/未認証）を集計して返す。
 *
 * @remarks
 * 全メンバーを取得し、会員ロール保持を「認証済み」、未保持かつ Allowlist 外を「未認証」として集計する。
 * 未認証者は先頭 20 件まで一覧表示する（読み取り専用・キックはしない）。応答は ephemeral。
 * 大量メンバー取得のため `deferReply` してから集計する。
 *
 * @param interaction - `/migration-status` のスラッシュコマンドインタラクション
 *
 * @since 0.5.0
 */
export async function handleMigrationStatus(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "サーバー内で実行してください。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [members, allowlist, links] = await Promise.all([
    interaction.guild.members.fetch(),
    listAllowlist(),
    listActiveLinks(),
  ]);

  const allowSet = new Set(allowlist.map((a) => a.discordId));
  const verifiedRoleId = config.discord.verifiedRoleId;

  const humans = members.filter((m) => !m.user.bot);
  const verified = humans.filter((m) => m.roles.cache.has(verifiedRoleId));
  const unverified = humans.filter(
    (m) => !m.roles.cache.has(verifiedRoleId) && !allowSet.has(m.id),
  );
  const allowlistedPresent = humans.filter((m) => allowSet.has(m.id));

  const total = humans.size;
  const rate = total > 0 ? Math.round((verified.size / total) * 100) : 0;
  const sample = unverified
    .first(20)
    .map((m) => `・${m.user.tag}`)
    .join("\n");

  const lines = [
    "**移行ステータス**",
    `総メンバー(非Bot): ${total}`,
    `認証済み(会員ロール): ${verified.size}（${rate}%）`,
    `未認証: ${unverified.size}`,
    `除外(Allowlist・在籍): ${allowlistedPresent.size}`,
    `Link レコード(DB・active): ${links.length}`,
    unverified.size > 0
      ? `\n未認証（先頭 ${Math.min(20, unverified.size)} 件）:\n${sample}`
      : "\nすべてのメンバーが認証済みです 🎉",
  ];

  await interaction.editReply(lines.join("\n"));
}
