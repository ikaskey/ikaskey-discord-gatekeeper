import { prisma } from "./db.js";
import { generateNonce } from "./ids.js";
import type { Link, VerificationState } from "./db.js";

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 認証URLの有効期限: 10分

/**
 * 同一 Misskey アカウントを別の Discord アカウントに紐付けようとした場合のエラー。
 *
 * @remarks
 * Discord と Misskey は 1:1 で連携する。既存の連携先 Discord ID は
 * {@link MisskeyAlreadyLinkedError.existingDiscordId} で参照できる。
 *
 * @since 0.1.0
 */
export class MisskeyAlreadyLinkedError extends Error {
  /**
   * @param existingDiscordId - 既に当該 Misskey アカウントと連携済みの Discord ID
   */
  constructor(
    /** 既に当該 Misskey アカウントと連携済みの Discord ID */
    readonly existingDiscordId: string,
  ) {
    super("このいかすきーアカウントは既に別のDiscordアカウントに連携済みです");
    this.name = "MisskeyAlreadyLinkedError";
  }
}

/**
 * 認証 state を発行し nonce を返す（ボタン押下時、bot 側で呼ぶ）。
 *
 * @remarks
 * 新規 nonce を採番して {@link VerificationState} を作成する。
 * 有効期限は `ttlMs`（既定 10 分）で決まる。
 *
 * @param input - 発行パラメータ
 * @param input.discordId - 認証を開始した Discord ユーザー ID
 * @param input.guildId - 対象の Guild ID
 * @param input.discordAccessToken - 自動参加(M6)用の Discord OAuth2 アクセストークン（任意）
 * @param input.ttlMs - 有効期限（ミリ秒）。省略時は 10 分
 * @returns 発行された nonce 文字列
 *
 * @example
 * ```ts
 * const nonce = await createVerificationState({
 *   discordId: "123",
 *   guildId: "456",
 * });
 * ```
 *
 * @since 0.1.0
 */
export async function createVerificationState(input: {
  discordId: string;
  guildId: string;
  discordAccessToken?: string;
  ttlMs?: number;
}): Promise<string> {
  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS));
  await prisma.verificationState.create({
    data: {
      nonce,
      discordId: input.discordId,
      guildId: input.guildId,
      discordAccessToken: input.discordAccessToken ?? null,
      expiresAt,
    },
  });
  return nonce;
}

/**
 * 採番した MiAuth セッション UUID を state に紐付ける（`/start`、web 側で呼ぶ）。
 *
 * @param nonce - 対象 state の nonce
 * @param session - 紐付ける MiAuth セッション UUID
 * @returns 完了を表す Promise
 *
 * @since 0.1.0
 */
export async function attachMiauthSession(nonce: string, session: string): Promise<void> {
  await prisma.verificationState.update({
    where: { nonce },
    data: { misskeySession: session },
  });
}

/**
 * 有効な（未消費かつ未期限切れの）state を取得する。
 *
 * @remarks
 * 存在しない・消費済み（`consumedAt` あり）・期限切れのいずれかなら `null` を返す。
 *
 * @param nonce - 取得対象の nonce
 * @returns 有効な {@link VerificationState}。無効な場合は `null`
 *
 * @since 0.1.0
 */
export async function getActiveState(nonce: string): Promise<VerificationState | null> {
  const st = await prisma.verificationState.findUnique({ where: { nonce } });
  if (!st) return null;
  if (st.consumedAt) return null;
  if (st.expiresAt.getTime() < Date.now()) return null;
  return st;
}

/**
 * state を消費済みにマークする（`consumedAt` を現在時刻に設定）。
 *
 * @remarks
 * 一度消費した state は {@link getActiveState} で `null` になり、再利用できない。
 *
 * @param nonce - 消費対象の nonce
 * @returns 完了を表す Promise
 *
 * @since 0.1.0
 */
export async function consumeState(nonce: string): Promise<void> {
  await prisma.verificationState.update({
    where: { nonce },
    data: { consumedAt: new Date() },
  });
}

/**
 * 認証完了時に {@link Link} を upsert する（web 側で呼ぶ）。
 *
 * @remarks
 * Discord と Misskey の 1:1 制約を守る。対象 Misskey アカウントが
 * 別の Discord アカウントに連携済みの場合は例外を投げる。既存の連携は更新、
 * 無ければ新規作成し、いずれも `status` を `active`、`failureCount` をリセットする。
 *
 * @param input - 連携パラメータ
 * @param input.discordId - 連携先 Discord ユーザー ID
 * @param input.guildId - 対象の Guild ID
 * @param input.misskeyId - 連携する Misskey ユーザー ID
 * @param input.username - Misskey のユーザー名
 * @param input.misskeyHost - Misskey のホスト名（ローカルは `null`）
 * @param input.token - 保存するアクセストークン（任意）
 * @returns upsert 後の {@link Link}
 * @throws {@link MisskeyAlreadyLinkedError} 当該 Misskey アカウントが別の Discord に連携済みの場合
 *
 * @example
 * ```ts
 * const link = await upsertLink({
 *   discordId: "123",
 *   guildId: "456",
 *   misskeyId: "abc",
 *   username: "alice",
 *   misskeyHost: null,
 * });
 * ```
 *
 * @since 0.1.0
 */
/**
 * Discord ユーザー ID から {@link Link}（認証済み連携）を取得する。
 *
 * @param discordId - 対象 Discord ユーザー ID
 * @returns 連携が存在すれば {@link Link}、無ければ `null`
 * @since 0.8.0
 */
export function findLinkByDiscordId(discordId: string): Promise<Link | null> {
  return prisma.link.findUnique({ where: { discordId } });
}

export async function upsertLink(input: {
  discordId: string;
  guildId: string;
  misskeyId: string;
  username: string;
  misskeyHost: string | null;
  token?: string | null;
}): Promise<Link> {
  const byMisskey = await prisma.link.findUnique({ where: { misskeyId: input.misskeyId } });
  if (byMisskey && byMisskey.discordId !== input.discordId) {
    throw new MisskeyAlreadyLinkedError(byMisskey.discordId);
  }

  return prisma.link.upsert({
    where: { discordId: input.discordId },
    create: {
      discordId: input.discordId,
      guildId: input.guildId,
      misskeyId: input.misskeyId,
      username: input.username,
      misskeyHost: input.misskeyHost,
      token: input.token ?? null,
      status: "active",
      lastCheckedAt: new Date(),
    },
    update: {
      misskeyId: input.misskeyId,
      username: input.username,
      misskeyHost: input.misskeyHost,
      token: input.token ?? null,
      status: "active",
      failureCount: 0,
      lastCheckedAt: new Date(),
    },
  });
}

/**
 * 期限切れの state を削除する（任意。定期実行向け）。
 *
 * @remarks
 * `expiresAt` が現在時刻より過去のレコードをまとめて削除する。
 *
 * @returns 削除したレコード件数
 *
 * @since 0.1.0
 */
export async function purgeExpiredStates(): Promise<number> {
  const res = await prisma.verificationState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return res.count;
}
