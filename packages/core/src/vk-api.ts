import { randomInt } from "node:crypto";

/** Клиент VK API (сообщения сообщества). */

export class VkApiError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "VkApiError";
  }
}

export async function vkApi<T = unknown>(method: string, params: Record<string, string | number | undefined>): Promise<T> {
  const token = process.env.VK_ACCESS_TOKEN;
  if (!token) throw new VkApiError(0, "VK_ACCESS_TOKEN не задан");
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, String(v));
  body.set("access_token", token);
  body.set("v", process.env.VK_API_VERSION ?? "5.199");
  const res = await fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json()) as { response?: T; error?: { error_code: number; error_msg: string } };
  if (json.error) throw new VkApiError(json.error.error_code, json.error.error_msg);
  return json.response as T;
}

export interface VkButton {
  label: string;
  payload?: Record<string, string>;
  color?: "primary" | "secondary" | "positive" | "negative";
  link?: string;
}

/** Клавиатура VK: массив рядов кнопок. Кнопка-ссылка (open_link) размещается в отдельном ряду. */
export function vkKeyboard(rows: VkButton[][], opts: { inline?: boolean; oneTime?: boolean } = {}): string {
  return JSON.stringify({
    one_time: opts.inline ? undefined : (opts.oneTime ?? false),
    inline: opts.inline ?? false,
    buttons: rows.map((row) =>
      row.map((b) =>
        b.link
          ? { action: { type: "open_link", link: b.link, label: b.label.slice(0, 40) } }
          : {
              action: { type: "text", label: b.label.slice(0, 40), payload: JSON.stringify(b.payload ?? {}) },
              color: b.color ?? "secondary",
            },
      ),
    ),
  });
}

export async function sendVkMessage(peerId: bigint | number, message: string, keyboard?: string, randomId?: number): Promise<void> {
  await vkApi("messages.send", {
    peer_id: peerId.toString(),
    message: message.slice(0, 4000),
    random_id: randomId ?? randomInt(1, 2 ** 31 - 1),
    keyboard,
    dont_parse_links: 1,
  });
}
