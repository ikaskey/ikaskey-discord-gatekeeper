// 生成クライアントは core パッケージ内（src/generated/prisma）に出力している。
// @prisma/client (v6) は CommonJS のため、ESM(Node 22+) からは default import で取り出す。
import pkg from "./generated/prisma/index.js";

const { PrismaClient } = pkg;

/**
 * プロセス内で共有する Prisma クライアントのシングルトン。
 *
 * @remarks
 * 接続プールを使い回すため、アプリ全体でこの単一インスタンスを参照する。
 *
 * @since 0.1.0
 */
export const prisma = new PrismaClient();

/**
 * Prisma が生成するモデル型の再エクスポート。
 *
 * @remarks
 * - `Link`: Discord と Misskey アカウントの 1:1 連携レコード。
 * - `VerificationState`: 認証フロー中の一時的な state（nonce / MiAuth セッション等）。
 * - `RoleMapping`: Misskey ロールから Discord ロールへのマッピング。
 * - `Allowlist`: 許可リストのエントリ。
 * - `AdminSession`: 管理画面のログインセッション（M5）。
 * - `AuditLog`: 監査ログ（M5）。
 *
 * @since 0.1.0
 */
export type {
  AdminSession,
  Allowlist,
  AuditLog,
  Link,
  RoleMapping,
  VerificationState,
} from "./generated/prisma/index.js";
