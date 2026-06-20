import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import {
  isPurgeCandidate,
  listActiveLinks,
  listAllowlist,
  loadConfig,
  writeAudit,
} from "@gatekeeper/core";

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

/**
 * `/migration-purge` コマンドのハンドラ。未認証メンバー（Phase 3）をキックする。
 *
 * @remarks
 * 強い安全弁つき:
 * - `dry_run`（既定 true）の間は**プレビューのみ**でキックしない。
 * - 実キックは環境変数 `MIGRATION_PURGE_ENABLED=true` が必須（未設定なら空振りして案内）。
 * - 対象は「Bot でない / 会員ロール無し / Allowlist 外 / 参加から `grace_days` 日以上」のメンバー。
 * - 1 回の上限 `limit`（既定 50）。`member.kickable` を満たすもののみキックし、監査ログに記録する。
 *
 * @param interaction - `/migration-purge` のスラッシュコマンドインタラクション
 *
 * @since 0.6.0
 */
export async function handleMigrationPurge(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "サーバー内で実行してください。",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const dryRun = interaction.options.getBoolean("dry_run") ?? true;
  const graceDays = interaction.options.getInteger("grace_days") ?? 14;
  const limit = interaction.options.getInteger("limit") ?? 50;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [members, allowlist] = await Promise.all([
    interaction.guild.members.fetch(),
    listAllowlist(),
  ]);
  const allowSet = new Set(allowlist.map((a) => a.discordId));
  const verifiedRoleId = config.discord.verifiedRoleId;
  const now = Date.now();

  const candidates = members.filter((m) =>
    isPurgeCandidate({
      isBot: m.user.bot,
      hasVerifiedRole: m.roles.cache.has(verifiedRoleId),
      allowlisted: allowSet.has(m.id),
      joinedAtMs: m.joinedTimestamp,
      nowMs: now,
      graceDays,
    }),
  );

  const willActuallyKick = !dryRun && config.migration.purgeEnabled;

  // dry-run、または env ゲート未許可 → プレビューのみ
  if (!willActuallyKick) {
    const sample = candidates
      .first(20)
      .map((m) => `・${m.user.tag}`)
      .join("\n");
    const gateNote =
      !dryRun && !config.migration.purgeEnabled
        ? "\n\n⚠️ 実キックには `MIGRATION_PURGE_ENABLED=true` が必要です（現在は未許可のためプレビューのみ）。"
        : "";
    await interaction.editReply(
      [
        `**未認証キック プレビュー（dry-run${gateNote ? "・envゲート未許可" : ""}）**`,
        `条件: 会員ロール無し / Allowlist外 / 参加から ${graceDays} 日以上`,
        `対象: ${candidates.size} 人（実行時は最大 ${limit} 人/回）`,
        candidates.size > 0 ? `\n対象（先頭 ${Math.min(20, candidates.size)} 件）:\n${sample}` : "",
        gateNote,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return;
  }

  // 実キック
  const targets = candidates.first(limit);
  let kicked = 0;
  let skipped = 0;
  for (const member of targets) {
    if (!member.kickable) {
      skipped++;
      continue;
    }
    try {
      await member.kick("未認証（段階移行 Phase 3）");
      await writeAudit({
        type: "migration_kick",
        summary: `未認証キック: @${member.user.tag}`,
        actor: interaction.user.id,
        targetDiscordId: member.id,
      }).catch(() => {});
      kicked++;
    } catch (err) {
      console.error(`[migration-purge] kick failed for ${member.id}`, err);
      skipped++;
    }
  }

  await interaction.editReply(
    [
      "**未認証キック 実行結果**",
      `キック: ${kicked} 人`,
      `スキップ（権限/階層/失敗）: ${skipped} 人`,
      `残り対象: ${Math.max(0, candidates.size - targets.length)} 人（再実行で続行）`,
    ].join("\n"),
  );
}
