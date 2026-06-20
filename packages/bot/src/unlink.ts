import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import type { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { deleteLinkByDiscordId, findLinkByDiscordId, writeAudit } from "@gatekeeper/core";

/** 連携解除を確定するボタンの `customId` 接頭辞（後ろに対象 Discord ユーザー ID が続く）。 */
export const UNLINK_CONFIRM_PREFIX = "unlink:confirm:";
/** 連携解除をキャンセルするボタンの `customId`。 */
export const UNLINK_CANCEL_ID = "unlink:cancel";

/**
 * `/unlink` の本体。対象ユーザーの連携を確認してから解除するため、確認ボタンを提示する（M9）。
 *
 * @remarks
 * 認可（モデレーター以上）は呼び出し側で {@link requireMisskeyLevel} により判定済みとする。
 * 連携が無ければその旨を返し、あれば確認ボタン付きの ephemeral メッセージを返す。
 *
 * @param interaction - `/unlink` のインタラクション
 * @since 0.8.6
 */
export async function handleUnlink(interaction: ChatInputCommandInteraction): Promise<void> {
  const target = interaction.options.getUser("user", true);
  const link = await findLinkByDiscordId(target.id);
  if (!link) {
    await interaction.reply({
      content: `<@${target.id}> のいかすきー連携は見つかりませんでした。`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const host = link.misskeyHost ? `@${link.misskeyHost}` : "";
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${UNLINK_CONFIRM_PREFIX}${target.id}`)
      .setLabel("連携を解除する")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(UNLINK_CANCEL_ID)
      .setLabel("キャンセル")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    content:
      `次の連携を解除します。よろしいですか？\n` +
      `・対象: <@${target.id}>\n` +
      `・いかすきー: @${link.username}${host}\n\n` +
      `解除後、本人は別のいかすきーアカウントで認証し直せます（Discordの会員ロール・参加自体は変更しません）。`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * 連携解除の確認ボタン押下時の処理。対象の連携を削除し、メッセージを結果に更新する（M9）。
 *
 * @remarks
 * 認可（モデレーター以上）は呼び出し側で再判定済みとする。`customId` 末尾の Discord ユーザー ID を
 * 対象とする。監査ログ（`link_unlink`）を記録する。
 *
 * @param interaction - 確認ボタンのインタラクション
 * @since 0.8.6
 */
export async function handleUnlinkConfirm(interaction: ButtonInteraction): Promise<void> {
  const discordId = interaction.customId.slice(UNLINK_CONFIRM_PREFIX.length);
  const removed = await deleteLinkByDiscordId(discordId);
  await writeAudit({
    type: "link_unlink",
    summary: `連携解除（コマンド）: ${discordId}`,
    actor: interaction.user.id,
    targetDiscordId: discordId,
  }).catch(() => {});
  await interaction.update({
    content:
      removed > 0
        ? `✅ <@${discordId}> のいかすきー連携を解除しました。本人は別アカウントで認証し直せます。`
        : `<@${discordId}> の連携は既に存在しませんでした。`,
    components: [],
  });
}

/**
 * 連携解除のキャンセルボタン押下時の処理。
 *
 * @param interaction - キャンセルボタンのインタラクション
 * @since 0.8.6
 */
export async function handleUnlinkCancel(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({ content: "連携解除をキャンセルしました。", components: [] });
}
