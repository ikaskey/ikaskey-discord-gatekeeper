import { SlashCommandBuilder } from "discord.js";

/**
 * `/verify-panel` スラッシュコマンドの定義。
 *
 * @remarks
 * 実行チャンネルに会員認証パネルを設置する。実行可否は実行時に判定する（Discord 管理者、
 * またはいかすきーの管理者のみ）。
 *
 * @see {@link allCommands}
 * @since 0.1.0
 */
export const verifyPanelCommand = new SlashCommandBuilder()
  .setName("verify-panel")
  .setDescription("このチャンネルに会員認証パネルを設置します（管理者用）");

/**
 * `/rolemap` スラッシュコマンドの定義（Misskeyロール↔Discordロール連動の管理）。
 *
 * @remarks
 * Misskey のロールに応じて Discord ロールを自動付与する「連動」を管理する。実行可否は
 * 実行時に判定する（Discord 管理者、またはいかすきーの管理者のみ）。
 *
 * @see {@link allCommands}
 * @since 0.3.0
 */
export const roleMapCommand = new SlashCommandBuilder()
  .setName("rolemap")
  .setDescription("Misskeyロール→Discordロールの自動連動を設定します（管理者用）")
  .addSubcommand((sc) => sc.setName("list").setDescription("現在の連動設定を一覧表示します"))
  .addSubcommand((sc) =>
    sc
      .setName("set")
      .setDescription("連動を追加・変更します（Misskeyロール → Discordロール）")
      .addStringOption((o) =>
        o.setName("misskey_role_id").setDescription("MisskeyのロールID").setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("misskey_role_name")
          .setDescription("Misskeyのロール名（一覧表示用のラベル）")
          .setRequired(true),
      )
      .addRoleOption((o) =>
        o.setName("discord_role").setDescription("付与するDiscordロール").setRequired(true),
      )
      .addBooleanOption((o) =>
        o.setName("enabled").setDescription("この連動を有効にするか（既定: 有効）"),
      ),
  )
  .addSubcommand((sc) =>
    sc
      .setName("remove")
      .setDescription("連動を削除します")
      .addStringOption((o) =>
        o.setName("misskey_role_id").setDescription("削除するMisskeyロールのID").setRequired(true),
      ),
  );

/**
 * `/migration-status` スラッシュコマンドの定義（移行の進捗確認）。
 *
 * @remarks
 * 認証済み/未認証の人数と未認証者の一覧を表示する読み取り専用コマンド。実行可否は
 * 実行時に判定する（Discord 管理者、またはいかすきーのモデレーター以上）。
 *
 * @see {@link allCommands}
 * @since 0.5.0
 */
export const migrationStatusCommand = new SlashCommandBuilder()
  .setName("migration-status")
  .setDescription("認証済み・未認証メンバーの人数と未認証者一覧を表示します（モデレーター用）");

/**
 * `/migration-purge` スラッシュコマンドの定義（未認証メンバーのキック）。
 *
 * @remarks
 * 既定はプレビューのみで、実際のキックには `dry_run:false` と環境変数
 * `MIGRATION_PURGE_ENABLED=true` の両方が必要。実行可否は実行時に判定する
 * （Discord 管理者、またはいかすきーのモデレーター以上）。
 *
 * @see {@link allCommands}
 * @since 0.6.0
 */
export const migrationPurgeCommand = new SlashCommandBuilder()
  .setName("migration-purge")
  .setDescription("未認証メンバーをキックします（既定は実行せずプレビュー表示・モデレーター用）")
  .addBooleanOption((o) =>
    o
      .setName("dry_run")
      .setDescription("プレビューのみ（既定: 有効）。無効にすると実際にキックします"),
  )
  .addIntegerOption((o) =>
    o
      .setName("grace_days")
      .setDescription("参加からこの日数以上経過した未認証者が対象（既定: 14日）")
      .setMinValue(0),
  )
  .addIntegerOption((o) =>
    o
      .setName("limit")
      .setDescription("1回でキックする最大人数（既定: 50）")
      .setMinValue(1)
      .setMaxValue(200),
  );

/**
 * デプロイ対象となる全スラッシュコマンドの一覧。
 *
 * @remarks
 * `deploy-commands.ts` がこの配列を参照し、各要素を `toJSON()` 化してギルドコマンドとして
 * 登録する。コマンドの可視性は絞らず（誰でもコマンド欄に表示される）、実行可否は各ハンドラ内で
 * {@link requireMisskeyLevel} により判定する。
 *
 * @see {@link verifyPanelCommand}
 * @see {@link roleMapCommand}
 * @see {@link migrationStatusCommand}
 * @see {@link migrationPurgeCommand}
 * @since 0.1.0
 */
export const allCommands = [
  verifyPanelCommand,
  roleMapCommand,
  migrationStatusCommand,
  migrationPurgeCommand,
];
