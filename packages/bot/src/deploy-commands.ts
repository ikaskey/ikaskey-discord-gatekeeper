/**
 * ギルドコマンド登録スクリプト。
 *
 * @remarks
 * {@link allCommands} を JSON 化し、`applicationGuildCommands` エンドポイントへ
 * `PUT` して指定ギルドにスラッシュコマンドを一括登録する単発スクリプト。
 * ギルドコマンドは即時反映されるため、常駐ボットの起動時ではなく
 * デプロイ時にこのスクリプトを 1 回だけ実行する運用とする。
 *
 * @see {@link allCommands} - 登録対象コマンドの一覧
 * @since 0.1.0
 */
import { REST, Routes } from "discord.js";
import { loadConfig } from "@gatekeeper/core";
import { allCommands } from "./commands.js";

// ギルドコマンドは即時反映。起動時ではなく、このスクリプトで1回だけ流す。
const config = loadConfig();
const rest = new REST({ version: "10" }).setToken(config.discord.token);
const body = allCommands.map((c) => c.toJSON());

const data = (await rest.put(
  Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
  { body },
)) as unknown[];

console.log(`Deployed ${data.length} guild command(s) to guild ${config.discord.guildId}.`);
