export type TelegramSendTarget = 'user' | 'global';

export type TelegramInlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
};

export interface TelegramSendJob {
  /** Resolved chat id for sendMessage (user DM or global channel/group). */
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  replyMarkup?: TelegramInlineKeyboard;
  /** Public HTTPS image URL — worker uses sendPhoto with text as caption. */
  photoUrl?: string;
  /** When false, Telegram may show link previews (sendMessage only). Default true. */
  disableWebPagePreview?: boolean;
  /** Forum topic thread id (Telegram message_thread_id). */
  messageThreadId?: number;
  /** Optional correlation for logs */
  userId?: string;
  kind?: string;
}
