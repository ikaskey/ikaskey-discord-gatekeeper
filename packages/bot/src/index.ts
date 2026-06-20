/**
 * Discord ボットの常駐エントリポイント。
 *
 * @remarks
 * discord.js の {@link https://discord.js.org/docs/packages/discord.js/main/Client:Class | Client}
 * を初期化し、以下のイベントを処理する常駐プロセスとして動作する。
 *
 * - `InteractionCreate`: `/verify-panel` コマンド実行および認証ボタン押下の処理。
 * - `GuildMemberAdd`: 新規参加メンバーの検知（M1 ではログのみ）。
 *
 * `GuildMembers` インテント（Server Members Intent）を有効化しているため、
 * Discord Developer Portal 側でも当該インテントを ON にしておく必要がある。
 * 認証 URL の発行など機微な応答は本人にのみ表示する ephemeral メッセージで返す。
 *
 * @see {@link sendVerifyPanel} - 認証パネル設置
 * @see {@link VERIFY_BUTTON_ID} - 認証ボタンの customId
 * @since 0.1.0
 */
import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import type { Interaction } from "discord.js";
import { createVerificationState, loadConfig } from "@gatekeeper/core";
import { requireMisskeyLevel } from "./auth.js";
import { handleMigrationPurge, handleMigrationStatus } from "./migration.js";
import { sendVerifyPanel, VERIFY_BUTTON_ID } from "./panel.js";
import { handleRoleMap } from "./rolemap.js";
import { startSweepSchedule } from "./sweep.js";

const config = loadConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Server Members Intent（Portalで要ON）
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`[bot] logged in as ${c.user.tag} (${c.user.id})`);
  // 退会連動: 定期検証スイープを開始（消滅/凍結を検知して即キック）
  startSweepSchedule(c);
});

/**
 * `InteractionCreate` ハンドラ。
 *
 * @remarks
 * 2 種類のインタラクションを処理する。
 *
 * 1. `/verify-panel` スラッシュコマンド: 送信可能なチャンネルであれば
 *    {@link sendVerifyPanel} で認証パネルを設置し、実行者には ephemeral で結果を返す。
 * 2. {@link VERIFY_BUTTON_ID} に一致する認証ボタン押下: 本人・ギルド単位の
 *    認証 state（nonce）を発行し、その nonce を埋め込んだ認証 URL を
 *    本人にのみ ephemeral で返す（URL は一定時間で失効）。
 *
 * いずれの分岐でも例外は捕捉し、未応答かつ応答可能な場合のみ
 * 汎用エラーメッセージを ephemeral で返す。
 */
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    // /verify-panel: 認証パネル設置（管理者）
    if (interaction.isChatInputCommand() && interaction.commandName === "verify-panel") {
      if (!(await requireMisskeyLevel(interaction, "administrator"))) return;
      const channel = interaction.channel;
      if (!channel || !channel.isSendable()) {
        await interaction.reply({
          content: "このチャンネルにはパネルを送信できません。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await sendVerifyPanel(channel);
      await interaction.reply({
        content: "認証パネルを設置しました。",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // /rolemap: Misskeyロール↔Discordロール連動の管理（管理者）
    if (interaction.isChatInputCommand() && interaction.commandName === "rolemap") {
      if (!(await requireMisskeyLevel(interaction, "administrator"))) return;
      await handleRoleMap(interaction);
      return;
    }

    // /migration-status: 移行の進捗（モデレーター以上）
    if (interaction.isChatInputCommand() && interaction.commandName === "migration-status") {
      if (!(await requireMisskeyLevel(interaction, "moderator"))) return;
      await handleMigrationStatus(interaction);
      return;
    }

    // /migration-purge: 未認証メンバーのキック（モデレーター以上）
    if (interaction.isChatInputCommand() && interaction.commandName === "migration-purge") {
      if (!(await requireMisskeyLevel(interaction, "moderator"))) return;
      await handleMigrationPurge(interaction);
      return;
    }

    // 認証ボタン: 本人にだけ固有の認証URLを返す
    // 本人 + ギルド単位の認証 state を発行し、nonce を埋め込んだ認証 URL を
    // ephemeral で本人にのみ返す（リンクは 10 分で失効）。
    if (interaction.isButton() && interaction.customId === VERIFY_BUTTON_ID) {
      if (!interaction.guildId) return;
      const nonce = await createVerificationState({
        discordId: interaction.user.id,
        guildId: interaction.guildId,
      });
      const url = `${config.web.publicBaseUrl}/auth/misskey/start?state=${encodeURIComponent(nonce)}`;
      await interaction.reply({
        content: [
          "以下のリンクからいかすきーで認証してください。",
          "（このリンクはあなたにのみ表示され、10分で失効します）",
          "",
          url,
        ].join("\n"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  } catch (err) {
    console.error("[bot] interaction error", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({
          content: "エラーが発生しました。時間をおいて再度お試しください。",
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }
  }
});

/**
 * `GuildMemberAdd` ハンドラ。
 *
 * @remarks
 * 新規参加メンバーを検知する。Bot アカウントは無視する。
 * 受信には `GuildMembers` インテント（Server Members Intent）が必要。
 * M1 では未認証メンバーのログ出力のみを行い、M2 で隔離ロジックへ拡張予定。
 */
// 新規参加検知（M2で隔離ロジックを拡張予定）。M1ではログのみ。
client.on(Events.GuildMemberAdd, (member) => {
  if (member.user.bot) return;
  console.log(`[bot] member joined: ${member.user.tag} (${member.id}) — 未認証`);
});

client.on(Events.Error, (e) => console.error("[bot] client error", e));
process.on("unhandledRejection", (reason) => console.error("[bot] unhandledRejection", reason));

await client.login(config.discord.token);
