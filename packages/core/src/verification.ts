import { prisma } from './db.js';
import { generateNonce } from './ids.js';
import type { Link, VerificationState } from './db.js';

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 認証URLの有効期限: 10分

/** 同一Misskeyアカウントが別Discordに紐付こうとした場合 */
export class MisskeyAlreadyLinkedError extends Error {
  constructor(readonly existingDiscordId: string) {
    super('このいかすきーアカウントは既に別のDiscordアカウントに連携済みです');
    this.name = 'MisskeyAlreadyLinkedError';
  }
}

/** ボタン押下時（bot）: 認証stateを発行し nonce を返す */
export async function createVerificationState(input: {
  discordId: string;
  guildId: string;
  ttlMs?: number;
}): Promise<string> {
  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS));
  await prisma.verificationState.create({
    data: {
      nonce,
      discordId: input.discordId,
      guildId: input.guildId,
      expiresAt,
    },
  });
  return nonce;
}

/** /start（web）: 採番した MiAuth セッションUUIDを state に紐付ける */
export async function attachMiauthSession(nonce: string, session: string): Promise<void> {
  await prisma.verificationState.update({
    where: { nonce },
    data: { misskeySession: session },
  });
}

/** 有効な（未消費・未期限切れの）state を取得。無効なら null */
export async function getActiveState(nonce: string): Promise<VerificationState | null> {
  const st = await prisma.verificationState.findUnique({ where: { nonce } });
  if (!st) return null;
  if (st.consumedAt) return null;
  if (st.expiresAt.getTime() < Date.now()) return null;
  return st;
}

export async function consumeState(nonce: string): Promise<void> {
  await prisma.verificationState.update({
    where: { nonce },
    data: { consumedAt: new Date() },
  });
}

/** 認証完了時（web）: Link を upsert。1:1 制約を守る */
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
      status: 'active',
      lastCheckedAt: new Date(),
    },
    update: {
      misskeyId: input.misskeyId,
      username: input.username,
      misskeyHost: input.misskeyHost,
      token: input.token ?? null,
      status: 'active',
      failureCount: 0,
      lastCheckedAt: new Date(),
    },
  });
}

/** 期限切れstateの掃除（任意。定期実行向け） */
export async function purgeExpiredStates(): Promise<number> {
  const res = await prisma.verificationState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return res.count;
}
