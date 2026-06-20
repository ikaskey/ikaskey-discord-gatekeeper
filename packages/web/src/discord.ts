import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { loadConfig } from "@gatekeeper/core";

// web はゲートウェイ不要。REST のみで ロール付与/剥奪/キック を行う。
const config = loadConfig();
const rest = new REST({ version: "10" }).setToken(config.discord.token);

export function addGuildMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
  reason: string,
): Promise<unknown> {
  return rest.put(Routes.guildMemberRole(guildId, userId, roleId), { reason });
}

export function removeGuildMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
  reason: string,
): Promise<unknown> {
  return rest.delete(Routes.guildMemberRole(guildId, userId, roleId), { reason });
}

export function kickGuildMember(guildId: string, userId: string, reason: string): Promise<unknown> {
  return rest.delete(Routes.guildMember(guildId, userId), { reason });
}
