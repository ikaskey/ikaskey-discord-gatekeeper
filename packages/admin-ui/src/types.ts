/**
 * 管理 API のレスポンス型定義。
 *
 * SPA は core パッケージから独立しているため、必要な型をここで自前定義する。
 *
 * @since 0.4.0
 */

/**
 * ログイン中の管理者情報（`GET /admin/api/me`）。
 *
 * @since 0.4.0
 */
export interface Me {
  misskeyId: string;
  username: string;
}

/**
 * Misskey ロール（`GET /admin/api/roles`、連動先選択用）。
 *
 * @since 0.4.0
 */
export interface MisskeyRole {
  id: string;
  name: string;
  color: string | null;
}

/**
 * ロール連動マッピング（`GET /admin/api/mappings`）。
 *
 * @since 0.4.0
 */
export interface RoleMapping {
  misskeyRoleId: string;
  misskeyRoleName: string;
  discordRoleId: string;
  enabled: boolean;
  autoSync: boolean;
}

/**
 * 除外リスト項目（`GET /admin/api/allowlist`）。
 *
 * @since 0.4.0
 */
export interface Allowlist {
  discordId: string;
  reason: string;
  createdAt: string;
}

/**
 * 監査ログ項目（`GET /admin/api/audit`）。
 *
 * @since 0.4.0
 */
export interface AuditLog {
  id: string;
  at: string;
  type: string;
  actor: string;
  targetDiscordId: string;
  summary: string;
}
