import cron from "node-cron";
import type { Client } from "discord.js";
import {
  computeModAdminRoleSync,
  computeRoleSync,
  listActiveRoleMappings,
  loadConfig,
  markKicked,
  MisskeyClient,
  runSweep,
  writeAudit,
} from "@gatekeeper/core";

const config = loadConfig();
const misskey = new MisskeyClient(config.misskey.host);

/**
 * 定期検証スイープを 1 回実行し、消滅が確認されたメンバーを Discord からキックする。
 *
 * @remarks
 * 判定（Misskey 存在確認・failureCount 更新・キック対象抽出）は core の
 * {@link @gatekeeper/core#runSweep} が担い、本関数は Discord 側の副作用を実施する:
 * 会員ロールの剥奪 → キック → {@link @gatekeeper/core#markKicked}。
 * すでに退出済みのメンバーは `kicked` として記録する。`member.kickable` で権限・ロール階層を
 * 事前確認し、キックできない場合や失敗時は status を `active` のまま残して次回スイープで再試行する。
 *
 * @param client - ログイン済みの discord.js {@link Client}
 *
 * @since 0.2.0
 */
export async function performSweep(client: Client): Promise<void> {
  const result = await runSweep(misskey, {
    failureThreshold: config.sweep.failureThreshold,
    recheckDelayMs: config.sweep.recheckDelayMs,
  });

  if (result.skipped) {
    console.warn(`[sweep] skipped: ${result.skipReason}`);
    return;
  }
  console.log(
    `[sweep] checked=${result.checked} kept=${result.kept} errored=${result.errored} toKick=${result.toKick.length}`,
  );

  for (const target of result.toKick) {
    try {
      const guild = await client.guilds.fetch(target.guildId);
      const member = await guild.members.fetch(target.discordId).catch(() => null);

      if (!member) {
        // 既に退出済み → kicked 扱いで記録
        await markKicked(target.discordId);
        console.log(`[sweep] already left: ${target.username} (${target.discordId})`);
        continue;
      }

      // 会員ロールを剥奪してからキック
      await member.roles.remove(config.discord.verifiedRoleId, target.reason).catch(() => {});

      if (!member.kickable) {
        console.warn(
          `[sweep] not kickable (権限/ロール階層): ${target.username} (${target.discordId})`,
        );
        continue;
      }

      await member.kick(target.reason);
      await markKicked(target.discordId);
      await writeAudit({
        type: "kick",
        summary: `キック: @${target.username} — ${target.reason}`,
        targetDiscordId: target.discordId,
      }).catch(() => {});
      console.log(`[sweep] kicked: ${target.username} (${target.discordId}) — ${target.reason}`);
    } catch (err) {
      // 失敗時は markKicked を呼ばない → status active のまま次回再試行
      console.error(`[sweep] kick failed for ${target.discordId}`, err);
    }
  }

  // M4: 存在を確認したメンバーの Discord ロールを Misskey ロールへ差分同期
  await syncRolesForMembers(client, result.toSyncRoles);
}

/**
 * 連動設定に基づき、各メンバーの Discord ロールを Misskey 保有ロールへ差分同期する。
 *
 * @remarks
 * 有効な {@link @gatekeeper/core#listActiveRoleMappings | 連動設定} が無ければ何もしない。
 * 管理対象（マッピングに含まれる Discord ロール）のみを操作し、会員ロールや手動ロールは触らない。
 *
 * @param client - ログイン済みの discord.js {@link Client}
 * @param targets - スイープで存在を確認したメンバーのロール同期対象
 *
 * @since 0.3.0
 */
async function syncRolesForMembers(
  client: Client,
  targets: {
    discordId: string;
    guildId: string;
    misskeyRoleIds: string[];
    authLevelKnown: boolean;
    isModerator: boolean;
    isAdministrator: boolean;
  }[],
): Promise<void> {
  if (targets.length === 0) return;
  const mappings = await listActiveRoleMappings();
  const { moderatorRoleId, adminRoleId } = config.misskey;
  const doModAdmin = Boolean(moderatorRoleId || adminRoleId);
  if (mappings.length === 0 && !doModAdmin) return;

  for (const target of targets) {
    try {
      const guild = await client.guilds.fetch(target.guildId);
      const member = await guild.members.fetch(target.discordId).catch(() => null);
      if (!member) continue;

      const current = new Set(member.roles.cache.map((r) => r.id));
      const toAdd = new Set<string>();
      const toRemove = new Set<string>();

      // M4: Misskey ロール連動
      if (mappings.length > 0) {
        const plan = computeRoleSync(new Set(target.misskeyRoleIds), mappings, current);
        for (const r of plan.toAdd) toAdd.add(r);
        for (const r of plan.toRemove) toRemove.add(r);
      }
      // M7: Misskey モデレーター/管理者連動（権限が判明している場合のみ）
      if (doModAdmin && target.authLevelKnown) {
        const plan = computeModAdminRoleSync({
          isModerator: target.isModerator,
          isAdministrator: target.isAdministrator,
          moderatorRoleId,
          adminRoleId,
          currentRoleIds: current,
        });
        for (const r of plan.toAdd) toAdd.add(r);
        for (const r of plan.toRemove) toRemove.add(r);
      }

      const addArr = [...toAdd].filter((r) => !toRemove.has(r));
      const removeArr = [...toRemove];
      if (addArr.length > 0) {
        await member.roles.add(addArr, "Misskey連動").catch((e: unknown) => {
          console.error(`[sweep] role add failed for ${target.discordId}`, e);
        });
      }
      if (removeArr.length > 0) {
        await member.roles.remove(removeArr, "Misskey連動").catch((e: unknown) => {
          console.error(`[sweep] role remove failed for ${target.discordId}`, e);
        });
      }
      if (addArr.length > 0 || removeArr.length > 0) {
        console.log(
          `[sweep] roles synced for ${target.discordId}: +${addArr.length} -${removeArr.length}`,
        );
      }
    } catch (err) {
      console.error(`[sweep] role sync failed for ${target.discordId}`, err);
    }
  }
}

/**
 * 設定の cron 式に従って定期検証スイープをスケジュールする。
 *
 * @remarks
 * `ClientReady` 後に一度だけ呼ぶこと。cron 式が不正な場合はスケジュールせずエラーログのみ出す。
 *
 * @param client - ログイン済みの discord.js {@link Client}
 *
 * @since 0.2.0
 */
export function startSweepSchedule(client: Client): void {
  if (!config.sweep.enabled) {
    console.log("[sweep] SWEEP_ENABLED=false のため定期検証は停止中（移行期間中のキルスイッチ）");
    return;
  }
  if (!cron.validate(config.sweep.cron)) {
    console.error(`[sweep] 無効な SWEEP_CRON: "${config.sweep.cron}" — スイープを開始しません`);
    return;
  }
  cron.schedule(config.sweep.cron, () => {
    performSweep(client).catch((e) => console.error("[sweep] unhandled error", e));
  });
  console.log(`[sweep] scheduled: "${config.sweep.cron}"`);
}
