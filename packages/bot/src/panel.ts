import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import type { SendableChannels } from 'discord.js';

/** 認証ボタンの customId（押下で本人にだけ認証URLを返す） */
export const VERIFY_BUTTON_ID = 'verify:start';

/** 認証パネル（永続メッセージ）を指定チャンネルに設置 */
export async function sendVerifyPanel(channel: SendableChannels): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x86b300)
    .setTitle('🦑 いかすきー会員認証')
    .setDescription(
      [
        'このサーバーは **いかすきー（Misskey）のアカウント保持者専用** です。',
        '',
        '下のボタンを押すと、あなただけに認証用リンクが表示されます。',
        'いかすきーでログイン・許可すると、会員ロールが付与されチャンネルが見えるようになります。',
      ].join('\n'),
    )
    .setFooter({ text: '認証リンクはあなたにのみ表示され、一定時間で失効します' });

  const button = new ButtonBuilder()
    .setCustomId(VERIFY_BUTTON_ID)
    .setLabel('いかすきーで認証')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🔑');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await channel.send({ embeds: [embed], components: [row] });
}
