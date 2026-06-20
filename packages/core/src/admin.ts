import { randomBytes } from "node:crypto";
import { prisma } from "./db.js";
import type { Allowlist, AuditLog } from "./db.js";

const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 管理セッションの有効期限: 12時間

/**
 * 管理画面のログインセッションを作成する（MiAuth 認証成功後）。
 *
 * @remarks
 * 返した `id` を署名付き Cookie に載せてクライアントへ渡す。`token` は roles/list 等の
 * Misskey API 呼び出しに再利用する。
 *
 * @param input - 認証済み管理者の情報と MiAuth トークン
 * @returns 生成したセッションの ID と有効期限
 * @since 0.4.0
 */
export async function createAdminSession(input: {
  misskeyId: string;
  username: string;
  token: string;
  ttlMs?: number;
}): Promise<{ id: string; expiresAt: Date }> {
  const id = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? ADMIN_SESSION_TTL_MS));
  await prisma.adminSession.create({
    data: {
      id,
      misskeyId: input.misskeyId,
      username: input.username,
      token: input.token,
      expiresAt,
    },
  });
  return { id, expiresAt };
}

/**
 * 有効な（未期限切れの）管理セッションを取得する。
 *
 * @param id - セッション ID（Cookie の値）
 * @returns セッション（`misskeyId` / `username` / `token`）または無効なら `null`
 * @since 0.4.0
 */
export async function getValidAdminSession(
  id: string,
): Promise<{ misskeyId: string; username: string; token: string } | null> {
  const s = await prisma.adminSession.findUnique({ where: { id } });
  if (!s) return null;
  if (s.expiresAt.getTime() < Date.now()) return null;
  return { misskeyId: s.misskeyId, username: s.username, token: s.token };
}

/**
 * 管理セッションを破棄する（ログアウト）。
 *
 * @param id - セッション ID
 * @since 0.4.0
 */
export async function deleteAdminSession(id: string): Promise<void> {
  await prisma.adminSession.delete({ where: { id } }).catch(() => {
    /* 既に無ければ無視 */
  });
}

/**
 * 監査ログを 1 件記録する。
 *
 * @param input - 記録内容（`type` / `summary` は必須）
 * @since 0.4.0
 */
export async function writeAudit(input: {
  type: string;
  summary: string;
  actor?: string | null;
  targetDiscordId?: string | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      type: input.type,
      summary: input.summary,
      actor: input.actor ?? null,
      targetDiscordId: input.targetDiscordId ?? null,
    },
  });
}

/**
 * 監査ログを新しい順に取得する。
 *
 * @param limit - 取得件数の上限（既定: 100）
 * @returns 監査ログの配列（`at` 降順）
 * @since 0.4.0
 */
export function listAuditLogs(limit = 100): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: limit });
}

/**
 * 検証除外リスト（Allowlist）を全件取得する。
 *
 * @returns {@link Allowlist} の配列（作成日時の降順）
 * @since 0.4.0
 */
export function listAllowlist(): Promise<Allowlist[]> {
  return prisma.allowlist.findMany({ orderBy: { createdAt: "desc" } });
}

/**
 * 検証除外リストに追加・更新する。
 *
 * @param discordId - 除外する Discord ユーザー ID
 * @param reason - 除外理由
 * @returns upsert された {@link Allowlist}
 * @since 0.4.0
 */
export function upsertAllowlist(discordId: string, reason: string): Promise<Allowlist> {
  return prisma.allowlist.upsert({
    where: { discordId },
    create: { discordId, reason },
    update: { reason },
  });
}

/**
 * 検証除外リストから削除する。
 *
 * @param discordId - 削除する Discord ユーザー ID
 * @since 0.4.0
 */
export async function deleteAllowlist(discordId: string): Promise<void> {
  await prisma.allowlist.delete({ where: { discordId } }).catch(() => {
    /* 既に無ければ無視 */
  });
}
