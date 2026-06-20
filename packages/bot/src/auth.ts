import { MessageFlags, PermissionFlagsBits } from "discord.js";
import type { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { findLinkByDiscordId, loadConfig, MisskeyClient } from "@gatekeeper/core";

const config = loadConfig();
const misskey = new MisskeyClient(config.misskey.host);

/** 要求する認可レベル。`moderator` はモデレーター以上、`administrator` は管理者のみ。 */
export type AuthLevel = "moderator" | "administrator";

/** 認可チェック対象となるインタラクション（スラッシュコマンド／ボタン）。 */
type GatedInteraction = ChatInputCommandInteraction | ButtonInteraction;

async function reject(interaction: GatedInteraction, message: string): Promise<void> {
  const opts = { content: message, flags: MessageFlags.Ephemeral } as const;
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(opts).catch(() => {});
  } else {
    await interaction.reply(opts).catch(() => {});
  }
}

/**
 * コマンド実行者が要求レベルを満たすかを Misskey 側の判定で確認する（M7）。
 *
 * @remarks
 * 認可の優先順位:
 * 1. Discord の **サーバー管理者(Administrator)** は常に許可（初期設定のロックアウト防止）。
 * 2. それ以外は、実行者の {@link @gatekeeper/core#findLinkByDiscordId | 連携} から Misskey トークンを引き、
 *    {@link @gatekeeper/core#MisskeyClient.checkAuthLevel | /api/i} で**その時点の** `isModerator` /
 *    `isAdministrator` を確認する（Misskey 側の最新設定が反映される）。
 *
 * 満たさない場合・未認証・通信失敗時は ephemeral で理由を返し `false` を返す。
 *
 * @param interaction - スラッシュコマンドのインタラクション
 * @param level - 要求する認可レベル
 * @returns 認可されれば `true`
 *
 * @since 0.8.0
 */
export async function requireMisskeyLevel(
  interaction: GatedInteraction,
  level: AuthLevel,
): Promise<boolean> {
  // 1) Discord サーバー管理者は常に許可
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // 2) Misskey 判定（要・認証済み）
  const link = await findLinkByDiscordId(interaction.user.id);
  if (!link?.token) {
    await reject(
      interaction,
      "このコマンドは、いかすきー認証済みのモデレーター/管理者のみ使用できます。先に認証してください。",
    );
    return false;
  }

  try {
    const lvl = await misskey.checkAuthLevel(link.token);
    const ok =
      level === "administrator" ? lvl.isAdministrator : lvl.isModerator || lvl.isAdministrator;
    if (!ok) {
      await reject(
        interaction,
        level === "administrator"
          ? "このコマンドは、いかすきーの管理者のみ使用できます。"
          : "このコマンドは、いかすきーのモデレーター以上のみ使用できます。",
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[auth] checkAuthLevel failed", err);
    await reject(interaction, "いかすきーとの通信に失敗しました。時間をおいて再度お試しください。");
    return false;
  }
}
