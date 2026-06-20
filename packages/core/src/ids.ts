import { randomBytes, randomUUID } from "node:crypto";

/**
 * URL に載せる推測不能な nonce（認証 state の識別子）を生成する。
 *
 * @remarks
 * 32 バイトのランダム値を base64url で表現する。認証フローの state を
 * URL から一意に特定するために用いる。
 *
 * @returns base64url エンコードされた nonce 文字列
 *
 * @example
 * ```ts
 * const nonce = generateNonce();
 * // 例: "dGhpcy1pcy1hLXJhbmRvbS1ub25jZQ"
 * ```
 *
 * @since 0.1.0
 */
export function generateNonce(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * MiAuth セッション UUID を生成する（フローごとに新規採番）。
 *
 * @remarks
 * MiAuth の認可 URL（`/miauth/{uuid}`）に用いるセッション識別子。
 *
 * @returns 新規に採番された UUID 文字列
 *
 * @since 0.1.0
 */
export function newMiauthSession(): string {
  return randomUUID();
}
