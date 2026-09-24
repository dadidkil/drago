import { db } from "@drago/database";
import {
  appUrl,
  audit,
  clearConversation,
  consumeLinkCode,
  createLogger,
  getConversation,
  getSettings,
  handleJoinInput,
  JOIN_STATE,
  publicUpcomingEvents,
  rateLimit,
  sendVkMessage,
  startJoinDialog,
  vkKeyboard,
  type VkButton,
} from "@drago/core";
import { EVENT_TYPE_LABELS, formatDateTime, truncate } from "@drago/shared";
import type { VkCallback } from "./server";

const log = createLogger("vk-bot");

interface VkMessage {
  from_id: number;
  peer_id: number;
  text: string;
  payload?: string;
}

const CMD = {
  about: "О Драго",
  join: "Вступить",
  events: "Ближайшие мероприятия",
  projects: "Наши проекты",
  contacts: "Контакты",
} as const;

function menu(): string {
  const rows: VkButton[][] = [
    [
      { label: CMD.about, payload: { cmd: "about" }, color: "primary" },
      { label: CMD.join, payload: { cmd: "join" }, color: "positive" },
    ],
    [{ label: CMD.events, payload: { cmd: "events" } }],
    [
      { label: CMD.projects, payload: { cmd: "projects" } },
      { label: CMD.contacts, payload: { cmd: "contacts" } },
    ],
    [{ label: "Сайт", link: appUrl("/") }],
  ];
  return vkKeyboard(rows);
}

function optionsKeyboard(options: { label: string; value: string }[]): string {
  return vkKeyboard([options.map((o) => ({ label: o.label, payload: { answer: o.value }, color: o.value === "отмена" ? "negative" : "primary" }))], { oneTime: true });
}

function commandOf(msg: VkMessage): string | null {
  if (msg.payload) {
    try {
      const p = JSON.parse(msg.payload) as { cmd?: string; command?: string };
      if (p.command === "start") return "start";
      if (p.cmd) return p.cmd;
    } catch {
      /* ignore */
    }
  }
  const t = msg.text.trim().toLowerCase();
  const entry = Object.entries(CMD).find(([, label]) => label.toLowerCase() === t);
  if (entry) return entry[0];
  if (/^(начать|старт|start|меню|привет|здравствуйте)$/i.test(t)) return "start";
  if (/^(сайт)$/i.test(t)) return "site";
  return null;
}

function answerOf(msg: VkMessage): string {
  if (msg.payload) {
    try {
      const p = JSON.parse(msg.payload) as { answer?: string };
      if (p.answer) return p.answer;
    } catch {
      /* ignore */
    }
  }
  return msg.text;
}

async function reply(peerId: number, text: string, keyboard?: string) {
  await sendVkMessage(peerId, text, keyboard ?? menu());
}

async function handleMessage(msg: VkMessage) {
  // Только личные сообщения сообществу (беседы игнорируем).
  if (msg.peer_id >= 2_000_000_000 || msg.from_id <= 0) return;
  const userId = BigInt(msg.from_id);
  const limit = await rateLimit(`vk:${msg.from_id}`, 20, 60);
  if (!limit.ok) return;

  // Привязка аккаунта: «привязать ABCD2345»
  const linkMatch = /^привязать\s+([A-Za-z0-9]{8})$/i.exec(msg.text.trim());
  if (linkMatch) return linkAccount(msg.peer_id, userId, linkMatch[1]!);

  const cmd = commandOf(msg);
  const conv = await getConversation("VK", userId);
  if (conv?.state === JOIN_STATE && !cmd) {
    const r = await handleJoinInput("VK", userId, conv.data as Record<string, string>, answerOf(msg), { vk: `id${msg.from_id}` });
    return reply(msg.peer_id, r.text, r.options ? optionsKeyboard(r.options) : menu());
  }
  if (conv && cmd) await clearConversation("VK", userId);

  const s = await getSettings(["site.general", "site.contacts", "integrations"]);
  switch (cmd) {
    case "start":
      return reply(msg.peer_id, `Привет! Это бот ТОП «Драго» 🐉\n${s["site.general"].heroSubtitle}\n\nВыбери, что интересно, в меню ниже.`);
    case "about": {
      const about = await db.page.findFirst({ where: { slug: "about", isPublished: true } });
      const text = about ? truncate(about.content.replace(/[#*_>`[\]]/g, "").replace(/\(\/[^)]*\)/g, ""), 1500) : s["site.general"].heroSubtitle;
      return reply(msg.peer_id, `${s["site.general"].siteName}\n\n${text}\n\nПодробнее: ${appUrl("/about")}`);
    }
    case "join": {
      const intro = `${s["site.general"].recruitmentText}\n\nАнкета на сайте: ${appUrl("/join")}`;
      if (!s.integrations.vkApplicationsEnabled) return reply(msg.peer_id, intro);
      const r = await startJoinDialog("VK", userId);
      return reply(msg.peer_id, `${intro}\n\nИли заполни анкету прямо здесь.\n\n${r.text}`, optionsKeyboard(r.options ?? []));
    }
    case "events": {
      const events = await publicUpcomingEvents(5);
      if (events.length === 0) return reply(msg.peer_id, `Ближайших открытых мероприятий пока нет. Следи за новостями сообщества!\n${appUrl("/events")}`);
      const text = events.map((e) => `• ${e.title} — ${EVENT_TYPE_LABELS[e.type]}, ${formatDateTime(e.startsAt)}${e.location ? `, ${e.location}` : ""}`).join("\n");
      return reply(msg.peer_id, `Ближайшие мероприятия:\n${text}\n\n${appUrl("/events")}`);
    }
    case "projects": {
      const projects = await db.project.findMany({ where: { isPublished: true }, orderBy: { sortOrder: "asc" }, take: 8 });
      if (projects.length === 0) return reply(msg.peer_id, `Проекты скоро появятся: ${appUrl("/projects")}`);
      return reply(msg.peer_id, `Наши проекты:\n${projects.map((p) => `• ${p.title} — ${p.summary}`).join("\n")}\n\n${appUrl("/projects")}`);
    }
    case "contacts": {
      const c = s["site.contacts"];
      const lines = [c.note, c.email && `Email: ${c.email}`, c.phone && `Телефон: ${c.phone}`, c.telegramUrl && `Telegram: ${c.telegramUrl}`, `Сайт: ${appUrl("/contacts")}`].filter(Boolean);
      return reply(msg.peer_id, lines.join("\n"));
    }
    case "site":
      return reply(msg.peer_id, appUrl("/"));
    default:
      return reply(msg.peer_id, "Выбери раздел в меню ниже 👇 Если нужен человек — напиши вопрос, командный состав ответит.");
  }
}

async function linkAccount(peerId: number, vkUserId: bigint, code: string) {
  const userId = await consumeLinkCode("VK", code);
  if (!userId) return reply(peerId, "Код недействителен или устарел. Получите новый в личном кабинете → «Безопасность».");
  const existing = await db.vkAccount.findUnique({ where: { vkUserId } });
  if (existing && existing.userId !== userId) return reply(peerId, "Этот аккаунт VK уже привязан к другому пользователю.");
  await db.vkAccount.upsert({ where: { userId }, create: { userId, vkUserId }, update: { vkUserId, canMessage: true, linkedAt: new Date() } });
  await audit({ actorId: userId, action: "integration.vk_linked", entity: "User", entityId: userId, metadata: { vkUserId: vkUserId.toString() } });
  return reply(peerId, "Готово! ВКонтакте привязан к вашему аккаунту ✅");
}

export async function handleEvent(event: VkCallback): Promise<void> {
  switch (event.type) {
    case "message_new": {
      const obj = event.object as { message?: VkMessage } | undefined;
      if (obj?.message && typeof obj.message.from_id === "number") await handleMessage({ ...obj.message, text: String(obj.message.text ?? "").slice(0, 2000) });
      break;
    }
    case "message_allow":
    case "message_deny": {
      const obj = event.object as { user_id?: number } | undefined;
      if (typeof obj?.user_id === "number") {
        await db.vkAccount.updateMany({ where: { vkUserId: BigInt(obj.user_id) }, data: { canMessage: event.type === "message_allow" } });
      }
      break;
    }
    default:
      log.debug("ignored event", { type: event.type });
  }
}
