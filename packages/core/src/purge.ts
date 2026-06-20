/**
 * 未認証キック（Phase 3）の対象判定に使う入力。
 *
 * @see {@link isPurgeCandidate}
 * @since 0.6.0
 */
export interface PurgeCandidateInput {
  /** Bot アカウントか */
  isBot: boolean;
  /** 会員ロールを保持しているか（= 認証済み） */
  hasVerifiedRole: boolean;
  /** 検証除外リスト（Allowlist）に含まれるか */
  allowlisted: boolean;
  /** サーバー参加日時（ms）。不明な場合は `null` */
  joinedAtMs: number | null;
  /** 現在時刻（ms） */
  nowMs: number;
  /** 猶予日数。参加からこの日数未満のメンバーは対象外（新規参加者の保護） */
  graceDays: number;
}

/**
 * 未認証メンバーがキック対象かを判定する純関数（副作用なし・テスト容易）。
 *
 * @remarks
 * 次を**すべて満たす**場合のみ `true`:
 * - Bot でない
 * - 会員ロールを持たない（未認証）
 * - Allowlist に含まれない
 * - 参加日時が判明しており、参加から `graceDays` 日以上経過している
 *
 * 参加日時不明（`joinedAtMs === null`）は安全側に倒して対象外とする。
 *
 * @param input - {@link PurgeCandidateInput}
 * @returns キック対象なら `true`
 *
 * @example
 * ```ts
 * const day = 24 * 60 * 60 * 1000;
 * isPurgeCandidate({ isBot: false, hasVerifiedRole: false, allowlisted: false,
 *   joinedAtMs: 0, nowMs: 20 * day, graceDays: 14 }); // => true（20日経過）
 * ```
 *
 * @since 0.6.0
 */
export function isPurgeCandidate(input: PurgeCandidateInput): boolean {
  if (input.isBot) return false;
  if (input.hasVerifiedRole) return false;
  if (input.allowlisted) return false;
  if (input.joinedAtMs === null) return false;
  const ageMs = input.nowMs - input.joinedAtMs;
  return ageMs >= input.graceDays * 24 * 60 * 60 * 1000;
}
