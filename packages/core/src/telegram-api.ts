/** Минимальный клиент Telegram Bot API для исходящих уведомлений (воркер). */

export interface TelegramSendResult {
  ok: boolean;
  errorCode?: number;
  description?: string;
  retryAfter?: number;
}

export async function sendTelegramMessage(
  chatId: bigint | number | string,
  text: string,
  opts: { buttonUrl?: string; buttonText?: string; keyboard?: { text: string; callback_data?: string; url?: string }[][] } = {},
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, errorCode: 0, description: "TELEGRAM_BOT_TOKEN не задан" };
  const body: Record<string, unknown> = {
    chat_id: chatId.toString(),
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  };
  const rows: { text: string; callback_data?: string; url?: string }[][] = [...(opts.keyboard ?? [])];
  if (opts.buttonUrl && /^https:\/\//.test(opts.buttonUrl)) rows.push([{ text: opts.buttonText ?? "Открыть", url: opts.buttonUrl }]);
  if (rows.length) body.reply_markup = { inline_keyboard: rows };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error_code?: number; description?: string; parameters?: { retry_after?: number } };
  if (json.ok) return { ok: true };
  return { ok: false, errorCode: json.error_code ?? res.status, description: json.description, retryAfter: json.parameters?.retry_after };
}
