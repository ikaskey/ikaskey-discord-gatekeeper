import { prisma } from "./db.js";
import type { RoleMapping } from "./db.js";

/**
 * ロール差分同期の計画（追加・剥奪する Discord ロール ID）。
 *
 * @see {@link computeRoleSync}
 * @since 0.3.0
 */
export interface RoleSyncPlan {
  /** 付与すべき Discord ロール ID */
  toAdd: string[];
  /** 剥奪すべき Discord ロール ID */
  toRemove: string[];
}

/**
 * Misskey の保有ロールと連動設定から、Discord ロールの差分（追加/剥奪）を計算する純関数。
 *
 * @remarks
 * **管理対象（マッピングに含まれる Discord ロール）だけ**を操作対象とし、それ以外の
 * Discord ロール（会員ロールや手動付与ロール）は一切触らない。
 * - ユーザーが対応する Misskey ロールを持つマッピング → その Discord ロールを「あるべき」とする。
 * - 管理対象のうち「あるべき」でないもの → 剥奪対象。
 * 副作用を持たないためテストしやすい。
 *
 * @param misskeyRoleIds - ユーザーが保有する Misskey 公開ロールの ID 集合
 * @param mappings - 適用する {@link RoleMapping} の配列（通常は有効なもののみ）
 * @param currentDiscordRoleIds - 対象メンバーが現在持つ Discord ロールの ID 集合
 * @returns 追加・剥奪する Discord ロール ID（{@link RoleSyncPlan}）
 *
 * @example
 * ```ts
 * // R1→D1, R2→D2 のマッピング。ユーザーは R1 を保有、現在 D2 と D9(管理外) を持つ
 * computeRoleSync(new Set(["R1"]), mappings, new Set(["D2", "D9"]));
 * // => { toAdd: ["D1"], toRemove: ["D2"] }  ※ D9 は管理外なので不変
 * ```
 *
 * @since 0.3.0
 */
export function computeRoleSync(
  misskeyRoleIds: ReadonlySet<string>,
  mappings: readonly RoleMapping[],
  currentDiscordRoleIds: ReadonlySet<string>,
): RoleSyncPlan {
  const managed = new Set(mappings.map((m) => m.discordRoleId));
  const desired = new Set(
    mappings.filter((m) => misskeyRoleIds.has(m.misskeyRoleId)).map((m) => m.discordRoleId),
  );

  const toAdd = [...desired].filter((id) => !currentDiscordRoleIds.has(id));
  const toRemove = [...managed].filter((id) => !desired.has(id) && currentDiscordRoleIds.has(id));
  return { toAdd, toRemove };
}

/**
 * 自動同期が有効な連動設定（`enabled` かつ `autoSync`）を取得する。
 *
 * @returns 有効な {@link RoleMapping} の配列
 * @since 0.3.0
 */
export function listActiveRoleMappings(): Promise<RoleMapping[]> {
  return prisma.roleMapping.findMany({ where: { enabled: true, autoSync: true } });
}

/**
 * 全ての連動設定を取得する（管理画面・一覧表示用）。
 *
 * @returns 全 {@link RoleMapping} の配列
 * @since 0.3.0
 */
export function listRoleMappings(): Promise<RoleMapping[]> {
  return prisma.roleMapping.findMany({ orderBy: { misskeyRoleName: "asc" } });
}

/**
 * 連動設定を追加・更新する（`misskeyRoleId` をキーに upsert）。
 *
 * @param input - 連動設定の内容
 * @returns upsert された {@link RoleMapping}
 * @since 0.3.0
 */
export function upsertRoleMapping(input: {
  misskeyRoleId: string;
  misskeyRoleName: string;
  discordRoleId: string;
  enabled?: boolean;
  autoSync?: boolean;
}): Promise<RoleMapping> {
  const data = {
    misskeyRoleName: input.misskeyRoleName,
    discordRoleId: input.discordRoleId,
    enabled: input.enabled ?? true,
    autoSync: input.autoSync ?? true,
  };
  return prisma.roleMapping.upsert({
    where: { misskeyRoleId: input.misskeyRoleId },
    create: { misskeyRoleId: input.misskeyRoleId, ...data },
    update: data,
  });
}

/**
 * 連動設定を削除する。
 *
 * @param misskeyRoleId - 削除対象の Misskey ロール ID
 * @since 0.3.0
 */
export function deleteRoleMapping(misskeyRoleId: string): Promise<unknown> {
  return prisma.roleMapping.delete({ where: { misskeyRoleId } });
}
