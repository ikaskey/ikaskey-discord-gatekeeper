import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import type { Interaction } from "discord.js";
import { createVerificationState, loadConfig } from "@gatekeeper/core";
import { sendVerifyPanel, VERIFY_BUTTON_ID } from "./panel.js";

const config = loadConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Server Members Intent（Portalで要ON）
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`[bot] logged in as ${c.user.tag} (${c.user.id})`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    // /verify-panel: 認証パネル設置
    if (interaction.isChatInputCommand() && interaction.commandName === "verify-panel") {
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

    // 認証ボタン: 本人にだけ固有の認証URLを返す
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

// 新規参加検知（M2で隔離ロジックを拡張予定）。M1ではログのみ。
client.on(Events.GuildMemberAdd, (member) => {
  if (member.user.bot) return;
  console.log(`[bot] member joined: ${member.user.tag} (${member.id}) — 未認証`);
});

client.on(Events.Error, (e) => console.error("[bot] client error", e));
process.on("unhandledRejection", (reason) => console.error("[bot] unhandledRejection", reason));

await client.login(config.discord.token);
