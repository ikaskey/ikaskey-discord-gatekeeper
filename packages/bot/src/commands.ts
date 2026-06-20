import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

/**
 * `/verify-panel` スラッシュコマンドの定義。
 *
 * @remarks
 * 実行チャンネルに認証パネルを設置するためのコマンド。
 * `setDefaultMemberPermissions(ManageGuild)` により、既定で
 * サーバー管理権限（Manage Guild）を持つメンバーのみが実行できる。
 *
 * @see {@link allCommands} - 登録対象コマンドの一覧
 * @since 0.1.0
 */
export const verifyPanelCommand = new SlashCommandBuilder()
  .setName("verify-panel")
  .setDescription("いかすきー認証パネルをこのチャンネルに設置します")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * デプロイ対象となる全スラッシュコマンドの一覧。
 *
 * @remarks
 * `deploy-commands.ts` がこの配列を参照し、各要素を `toJSON()` 化して
 * ギルドコマンドとして登録する。新しいコマンドを追加した際はこの配列に含める。
 *
 * @see {@link verifyPanelCommand}
 * @since 0.1.0
 */
export const allCommands = [verifyPanelCommand];
