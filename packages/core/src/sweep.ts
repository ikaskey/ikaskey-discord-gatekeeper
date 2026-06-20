import { prisma } from "./db.js";
import type { Link } from "./db.js";
import type { MisskeyClient } from "./misskey.js";

/**
 * 定期検証スイープのオプション。
 *
 * @see {@link runSweep}
 * @since 0.2.0
 */
export interface SweepOptions {
  /** 連続「消滅」確認がこの回数に達したらキック対象とする */
  failureThreshold: number;
  /** 同一スイープ内で「消滅」を再確認する待ち時間(ms) */
  recheckDelayMs: number;
}

/**
 * キック対象の 1 件。
 *
 * @since 0.2.0
 */
export interface ToKick {
  discordId: string;
  guildId: string;
  username: string;
  /** 監査ログ・キック理由 */
  reason: string;
}

/**
 * ロール同期対象の 1 件（存在を確認したメンバー）。
 *
 * @remarks
 * `misskeyRoleIds` はその時点の Misskey 公開ロール ID。呼び出し側（bot）が連動設定と
 * 突き合わせて Discord ロールを差分同期する。
 *
 * @see {@link @gatekeeper/core#computeRoleSync}
 * @since 0.3.0
 */
export interface ToSyncRoles {
  discordId: string;
  guildId: string;
  /** その時点で保有する Misskey 公開ロールの ID */
  misskeyRoleIds: string[];
  /**
   * Misskey のモデレーター/管理者状態が判明しているか（トークンで `/api/i` を引けた場合 `true`）。
   * `false` の場合 mod/admin 連動はスキップする（古い判定で剥奪しないため）。
   * @since 0.8.1
   */
  authLevelKnown: boolean;
  /** Misskey モデレーターか（`authLevelKnown` が `true` のときのみ有効）@since 0.8.1 */
  isModerator: boolean;
  /** Misskey 管理者か（`authLevelKnown` が `true` のときのみ有効）@since 0.8.1 */
  isAdministrator: boolean;
}

/**
 * スイープの集計結果。
 *
 * @since 0.2.0
 */
export interface SweepResult {
  /** ヘルスチェック失敗等で全体をスキップしたか */
  skipped: boolean;
  /** スキップ理由（`skipped` が `true` のとき） */
  skipReason?: string;
  /** 検証したリンク数 */
  checked: number;
  /** 存在を確認し維持した数 */
  kept: number;
  /** キック対象のリスト（Discord 操作は呼び出し側が実施） */
  toKick: ToKick[];
  /** 存在を確認したメンバーのロール同期対象（M4: ロール自動連動） */
  toSyncRoles: ToSyncRoles[];
  /** API/ネットワークエラーで判定を保留した数 */
  errored: number;
}

/**
 * 「消滅」確認の有無と現在の failureCount から、新しい failureCount とキック要否を決める純関数。
 *
 * @remarks
 * 副作用を持たないためテストしやすい。`gone` が `false`（存在を確認）なら failureCount は 0 に
 * リセットされる。`gone` が `true` なら failureCount を 1 増やし、`failureThreshold` 以上で
 * キック対象とする。
 *
 * @param gone - 対象が消滅（404/凍結）と確認されたか
 * @param currentFailureCount - 現在の連続失敗カウント
 * @param failureThreshold - キックに必要な連続失敗回数
 * @returns 新しい failureCount とキック要否
 *
 * @example
 * ```ts
 * decideAction(true, 0, 1); // => { kick: true, newFailureCount: 1 }（即キック設定）
 * decideAction(true, 0, 2); // => { kick: false, newFailureCount: 1 }（次回確定）
 * decideAction(false, 5, 2); // => { kick: false, newFailureCount: 0 }（復活でリセット）
 * ```
 *
 * @since 0.2.0
 */
export function decideAction(
  gone: boolean,
  currentFailureCount: number,
  failureThreshold: number,
): { kick: boolean; newFailureCount: number } {
  if (!gone) return { kick: false, newFailureCount: 0 };
  const next = currentFailureCount + 1;
  return { kick: next >= failureThreshold, newFailureCount: next };
}

/**
 * status が `active` の全リンクを取得する。
 *
 * @returns アクティブな {@link Link} の配列
 * @since 0.2.0
 */
export function listActiveLinks(): Promise<Link[]> {
  return prisma.link.findMany({ where: { status: "active" } });
}

/**
 * 検証除外リスト（モデレーター等）に含まれるかを返す。
 *
 * @param discordId - 判定対象の Discord ユーザー ID
 * @returns Allowlist に存在すれば `true`
 * @since 0.2.0
 */
export async function isAllowlisted(discordId: string): Promise<boolean> {
  const row = await prisma.allowlist.findUnique({ where: { discordId } });
  return row !== null;
}

/**
 * キック実行後に Link を `kicked` 状態へ更新する。
 *
 * @remarks
 * Discord 側のキックが成功した後に呼ぶこと。これにより次回以降のスイープ対象から外れる。
 * キックに失敗した場合は呼ばず、status を `active` のまま残すことで次回スイープで再試行される。
 *
 * @param discordId - キックした Discord ユーザー ID
 * @since 0.2.0
 */
export function markKicked(discordId: string): Promise<unknown> {
  return prisma.link.update({
    where: { discordId },
    data: { status: "kicked", lastCheckedAt: new Date() },
  });
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 定期検証スイープを実行する（退会連動の中核）。
 *
 * @remarks
 * 処理の流れ:
 * 1. **ヘルスチェック** — インスタンスに到達できなければ全体をスキップ（API 一時障害での誤キック防止）。
 * 2. 各アクティブリンクについて Misskey の存在確認。Allowlist は除外。
 * 3. 「消滅」っぽい場合は `recheckDelayMs` 待って**同一スイープ内で再確認**（瞬間的な不整合を排除）。
 * 4. {@link decideAction} で failureCount を更新し、しきい値に達したものを `toKick` に積む。
 * 5. 429/5xx/ネットワークエラーは**判定保留**（キックしない）。
 *
 * Discord 側のキック・ロール剥奪は行わない。戻り値の `toKick` を使って呼び出し側（bot）が実施し、
 * 成功後に {@link markKicked} を呼ぶ。
 *
 * @param client - 対象インスタンスの {@link MisskeyClient}
 * @param opts - {@link SweepOptions}
 * @returns {@link SweepResult}
 *
 * @since 0.2.0
 */
export async function runSweep(client: MisskeyClient, opts: SweepOptions): Promise<SweepResult> {
  const healthy = await client.healthCheck();
  if (!healthy) {
    return {
      skipped: true,
      skipReason: "Misskeyインスタンスに到達できません",
      checked: 0,
      kept: 0,
      toKick: [],
      toSyncRoles: [],
      errored: 0,
    };
  }

  const links = await listActiveLinks();
  const result: SweepResult = {
    skipped: false,
    checked: 0,
    kept: 0,
    toKick: [],
    toSyncRoles: [],
    errored: 0,
  };

  for (const link of links) {
    if (await isAllowlisted(link.discordId)) continue;
    result.checked++;
    try {
      let p = await probeMember(client, link);
      if (!p.exists) {
        await sleep(opts.recheckDelayMs);
        p = await probeMember(client, link);
      }
      const { kick, newFailureCount } = decideAction(
        !p.exists,
        link.failureCount,
        opts.failureThreshold,
      );
      await prisma.link.update({
        where: { discordId: link.discordId },
        data: { failureCount: newFailureCount, lastCheckedAt: new Date() },
      });
      if (kick) {
        result.toKick.push({
          discordId: link.discordId,
          guildId: link.guildId,
          username: link.username,
          reason: "いかすきーアカウントの消滅/凍結を確認",
        });
      } else {
        result.kept++;
        // M4/M7: 存在を確認したメンバーはロール同期対象に積む
        result.toSyncRoles.push({
          discordId: link.discordId,
          guildId: link.guildId,
          misskeyRoleIds: p.roleIds,
          authLevelKnown: p.authLevelKnown,
          isModerator: p.isModerator,
          isAdministrator: p.isAdministrator,
        });
      }
    } catch {
      // 429 / 5xx / ネットワーク等 → 判定保留（キックしない）
      result.errored++;
    }
  }

  return result;
}

/**
 * 1 メンバーの存在確認とロール/権限の取得。トークンがあれば `/api/i` で存在＋ロール＋
 * モデレーター/管理者を一度に取得し、無ければ `users/show` で存在＋公開ロールのみ取得する。
 */
async function probeMember(
  client: MisskeyClient,
  link: Link,
): Promise<{
  exists: boolean;
  roleIds: string[];
  authLevelKnown: boolean;
  isModerator: boolean;
  isAdministrator: boolean;
}> {
  if (link.token) {
    const lvl = await client.checkAuthLevel(link.token);
    return {
      exists: lvl.exists,
      roleIds: lvl.roleIds,
      authLevelKnown: true,
      isModerator: lvl.isModerator,
      isAdministrator: lvl.isAdministrator,
    };
  }
  const r = await client.checkUserExists(link.misskeyId);
  return {
    exists: r.exists,
    roleIds: (r.user?.roles ?? []).map((x) => x.id),
    authLevelKnown: false,
    isModerator: false,
    isAdministrator: false,
  };
}
