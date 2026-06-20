import cron from "node-cron";
import type { Client } from "discord.js";
import { MisskeyClient, loadConfig, markKicked, runSweep } from "@gatekeeper/core";

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
      console.log(`[sweep] kicked: ${target.username} (${target.discordId}) — ${target.reason}`);
    } catch (err) {
      // 失敗時は markKicked を呼ばない → status active のまま次回再試行
      console.error(`[sweep] kick failed for ${target.discordId}`, err);
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
  if (!cron.validate(config.sweep.cron)) {
    console.error(`[sweep] 無効な SWEEP_CRON: "${config.sweep.cron}" — スイープを開始しません`);
    return;
  }
  cron.schedule(config.sweep.cron, () => {
    performSweep(client).catch((e) => console.error("[sweep] unhandled error", e));
  });
  console.log(`[sweep] scheduled: "${config.sweep.cron}"`);
}
