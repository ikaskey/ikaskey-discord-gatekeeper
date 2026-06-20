import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

/** /verify-panel — 認証パネルを設置（サーバー管理権限が必要） */
export const verifyPanelCommand = new SlashCommandBuilder()
  .setName('verify-panel')
  .setDescription('いかすきー認証パネルをこのチャンネルに設置します')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const allCommands = [verifyPanelCommand];
