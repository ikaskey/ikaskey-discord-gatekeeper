import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { SendableChannels } from "discord.js";
import { loadConfig } from "@gatekeeper/core";

const config = loadConfig();

/**
 * 認証パネルのボタンに割り当てる `customId`。
 *
 * @remarks
 * このボタンが押下されると、本人にだけ ephemeral で固有の認証 URL を返す。
 * `index.ts` の `InteractionCreate` ハンドラ側でこの値と一致する `customId` を
 * 持つボタン押下を判定するため、ここで定義した定数を双方で共有する。
 *
 * @see {@link sendVerifyPanel} - この `customId` を持つボタンを設置する関数
 * @since 0.1.0
 */
export const VERIFY_BUTTON_ID = "verify:start";

/**
 * 認証パネル（永続メッセージ）を指定チャンネルに設置する。
 *
 * @remarks
 * Embed（案内文）と「いかすきーで認証」ボタンを 1 件のメッセージとして送信する。
 * ボタンの `customId` には {@link VERIFY_BUTTON_ID} を用いる。
 * パネルは常設メッセージとして残り、各ユーザーがボタンを押すたびに
 * 本人にのみ ephemeral で認証 URL が返される設計のため、メッセージ自体は
 * 個別ユーザーに依存しない。
 *
 * @param channel - パネルを送信する送信可能チャンネル（`SendableChannels`）。
 * @returns 送信完了で解決する `Promise`。
 *
 * @example
 * ```ts
 * if (channel.isSendable()) {
 *   await sendVerifyPanel(channel);
 * }
 * ```
 *
 * @see {@link VERIFY_BUTTON_ID}
 * @since 0.1.0
 */
export async function sendVerifyPanel(channel: SendableChannels): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x86b300)
    .setTitle(`🦑 ${config.misskey.appName}`)
    .setDescription(
      [
        "このサーバーは **いかすきー（Misskey）のアカウント保持者専用** です。",
        "",
        "下のボタンを押すと、あなただけに認証用リンクが表示されます。",
        "いかすきーでログイン・許可すると、会員ロールが付与されチャンネルが見えるようになります。",
      ].join("\n"),
    )
    .setFooter({ text: "認証リンクはあなたにのみ表示され、一定時間で失効します" });

  const button = new ButtonBuilder()
    .setCustomId(VERIFY_BUTTON_ID)
    .setLabel("いかすきーで認証")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("🔑");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await channel.send({ embeds: [embed], components: [row] });
}
