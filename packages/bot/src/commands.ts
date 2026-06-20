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
 * `/rolemap` スラッシュコマンドの定義（Misskeyロール↔Discordロール連動の管理）。
 *
 * @remarks
 * 管理画面（M5）が用意されるまでの暫定的な管理手段。`list` / `set` / `remove` の
 * サブコマンドを持ち、既定でサーバー管理権限（Manage Guild）を持つメンバーのみが実行できる。
 *
 * @see {@link allCommands}
 * @since 0.3.0
 */
export const roleMapCommand = new SlashCommandBuilder()
  .setName("rolemap")
  .setDescription("Misskeyロール→Discordロールの連動設定を管理します")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sc) => sc.setName("list").setDescription("連動設定の一覧を表示"))
  .addSubcommand((sc) =>
    sc
      .setName("set")
      .setDescription("連動設定を追加/更新")
      .addStringOption((o) =>
        o.setName("misskey_role_id").setDescription("MisskeyロールID").setRequired(true),
      )
      .addStringOption((o) =>
        o.setName("misskey_role_name").setDescription("Misskeyロール名").setRequired(true),
      )
      .addRoleOption((o) =>
        o.setName("discord_role").setDescription("対応するDiscordロール").setRequired(true),
      )
      .addBooleanOption((o) => o.setName("enabled").setDescription("有効にするか（既定: true）")),
  )
  .addSubcommand((sc) =>
    sc
      .setName("remove")
      .setDescription("連動設定を削除")
      .addStringOption((o) =>
        o.setName("misskey_role_id").setDescription("MisskeyロールID").setRequired(true),
      ),
  );

/**
 * デプロイ対象となる全スラッシュコマンドの一覧。
 *
 * @remarks
 * `deploy-commands.ts` がこの配列を参照し、各要素を `toJSON()` 化して
 * ギルドコマンドとして登録する。新しいコマンドを追加した際はこの配列に含める。
 *
 * @see {@link verifyPanelCommand}
 * @see {@link roleMapCommand}
 * @since 0.1.0
 */
export const allCommands = [verifyPanelCommand, roleMapCommand];
