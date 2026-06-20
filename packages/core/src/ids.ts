import { randomBytes, randomUUID } from 'node:crypto';

/** URLに載せる推測不能なnonce（認証stateの識別子） */
export function generateNonce(): string {
  return randomBytes(32).toString('base64url');
}

/** MiAuth セッションUUID（フローごとに新規採番） */
export function newMiauthSession(): string {
  return randomUUID();
}
