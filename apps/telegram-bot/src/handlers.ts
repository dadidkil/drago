import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { db } from "@drago/database";
import {
  announcementsForLevel,
  appUrl,
  audit,
  clearConversation,
  consumeLinkCode,
  createLogger,
  documentsForLevel,
  getConversation,
  getSettings,
  markProcessed,
  notifyAudience,
  openTasksForUser,
  rateLimit,
  setConversation,
  upcomingEventsForUser,
} from "@drago/core";
import {
  APPLICATION_SOURCE_LABELS,
  AUDIENCES,
  EVENT_TYPE_LABELS,
  PARTICIPATION_LABELS,
  TASK_STATUS_LABELS,
  escapeHtml,
  formatDateTime,
  fullName,
  truncate,
} from "@drago/shared";
import { resolveLinkedUser, type BotContext } from "./context";
import { BTN, mainKeyboard, rsvpKeyboard, taskKeyboard } from "./keyboards";

const log = createLogger("telegram-bot");
const html = { parse_mode: "HTML" as const, link_preview_options: { is_disabled: true } };
const NOT_LINKED = "Эта функция доступна после привязки аккаунта. Откройте личный кабинет → «Безопасность» → «Подключить Telegram».";
const ANNOUNCE_STATE = "announce";

export function registerHandlers(bot: Bot<BotContext>) {
  // ── Общие middleware: только личные чаты, дедупликация, rate limit, определение пользователя ──
  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.type !== "private") return;
    if (!(await markProcessed("telegram", String(ctx.update.update_id)))) return;
    if (ctx.from) {
      const limit = await rateLimit(`tg:${ctx.from.id}`, 30, 60);
      if (!limit.ok) return;
      ctx.linked = await resolveLinkedUser(ctx.from.id);
    } else {
      ctx.linked = null;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim() ?? "";
    if (payload.startsWith("link_")) return linkAccount(ctx, payload.slice(5));
    const name = ctx.linked?.profile?.firstName;
    await ctx.reply(
      ctx.linked
        ? `Привет, ${escapeHtml(name ?? "боец")}! 🐉\nВыбирай раздел в меню ниже. Уведомления о задачах, мероприятиях и объявлениях будут приходить сюда.`
        : "Привет! Это бот трудового отряда подростков <b>ТОП «Драго»</b> 🐉\n\nБойцы получают здесь уведомления и доступ к задачам и мероприятиям — для этого привяжите аккаунт в личном кабинете (раздел «Безопасность»).\n\nХочешь в отряд? Нажми «Вступить».",
      { ...html, reply_markup: mainKeyboard(ctx.linked) },
    );
  });

  bot.command("help", (ctx) =>
    ctx.reply(
      [
        "<b>Команды</b>",
        "/events — ближайшие мероприятия",
        "/tasks — мои задачи",
        "/announcements — объявления",
        "/documents — документы",
        "/profile — профиль",
        "/contacts — контакты отряда",
        "/cabinet — личный кабинет",
        "/join — как вступить в отряд",
        "/unlink — отвязать Telegram",
        ...(ctx.linked?.can("applications.read") ? ["", "<b>Командный состав</b>", "/applications — новые заявки"] : []),
        ...(ctx.linked?.can("events.manage") ? ["/participants — участники мероприятий"] : []),
        ...(ctx.linked?.can("announcements.manage") ? ["/announce — создать объявление"] : []),
        "",
        "Критичные административные действия выполняются только в веб-админке.",
      ].join("\n"),
      html,
    ),
  );

  bot.command("cabinet", (ctx) => ctx.reply("Личный кабинет:", { reply_markup: new InlineKeyboard().url("Открыть кабинет", appUrl("/cabinet")) }));
  bot.hears(BTN.cabinet, (ctx) => ctx.reply("Личный кабинет:", { reply_markup: new InlineKeyboard().url("Открыть кабинет", appUrl("/cabinet")) }));

  bot.command("profile", profile);
  bot.command(["events"], events);
  bot.hears(BTN.events, events);
  bot.command("tasks", tasks);
  bot.hears(BTN.tasks, tasks);
  bot.command("announcements", announcements);
  bot.hears(BTN.announcements, announcements);
  bot.command("documents", documents);
  bot.hears(BTN.documents, documents);
  bot.command("contacts", contacts);
  bot.hears(BTN.contacts, contacts);
  bot.hears(BTN.about, about);
  bot.command("join", join);
  bot.hears(BTN.join, join);
  bot.command("applications", applications);
  bot.hears(BTN.applications, applications);
  bot.command("participants", participants);
  bot.command("announce", announce);
  bot.command("cancel", async (ctx) => {
    if (ctx.from) await clearConversation("TELEGRAM", BigInt(ctx.from.id));
    await ctx.reply("Отменено.", { reply_markup: mainKeyboard(ctx.linked) });
  });

  bot.command("unlink", async (ctx) => {
    if (!ctx.linked || !ctx.from) return ctx.reply("Аккаунт не привязан.");
    await db.telegramAccount.delete({ where: { telegramUserId: BigInt(ctx.from.id) } });
    await audit({ actorId: ctx.linked.id, action: "integration.telegram_unlinked", entity: "User", entityId: ctx.linked.id, metadata: { via: "bot" } });
    await ctx.reply("Telegram отвязан от аккаунта. Уведомления больше не будут приходить.", { reply_markup: mainKeyboard(null) });
  });

  // ── Inline-кнопки ──
  bot.callbackQuery(/^rsvp:([a-z0-9]{10,40}):(GOING|MAYBE|NOT_GOING)$/, async (ctx) => {
    if (!ctx.linked) return ctx.answerCallbackQuery({ text: NOT_LINKED, show_alert: true });
    const [, eventId, status] = ctx.match as RegExpMatchArray;
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event || event.minRoleLevel > ctx.linked.level || event.status === "CANCELLED") return ctx.answerCallbackQuery({ text: "Мероприятие недоступно" });
    if (status === "GOING" && event.capacity) {
      const going = await db.eventParticipant.count({ where: { eventId: event.id, status: "GOING", userId: { not: ctx.linked.id } } });
      if (going >= event.capacity) return ctx.answerCallbackQuery({ text: "Мест больше нет", show_alert: true });
    }
    await db.eventParticipant.upsert({
      where: { eventId_userId: { eventId: event.id, userId: ctx.linked.id } },
      create: { eventId: event.id, userId: ctx.linked.id, status: status as "GOING", respondedAt: new Date() },
      update: { status: status as "GOING", respondedAt: new Date() },
    });
    await ctx.answerCallbackQuery({ text: `Ответ: ${PARTICIPATION_LABELS[status as "GOING"]}` });
  });

  bot.callbackQuery(/^task:([a-z0-9]{10,40}):(IN_PROGRESS|DONE)$/, async (ctx) => {
    if (!ctx.linked) return ctx.answerCallbackQuery({ text: NOT_LINKED, show_alert: true });
    const [, taskId, status] = ctx.match as RegExpMatchArray;
    const task = await db.task.findFirst({ where: { id: taskId, assignees: { some: { userId: ctx.linked.id } } } });
    if (!task || task.status === "CANCELLED") return ctx.answerCallbackQuery({ text: "Задача недоступна" });
    await db.task.update({ where: { id: task.id }, data: { status: status as "DONE" } });
    await audit({ actorId: ctx.linked.id, action: "task.status", entity: "Task", entityId: task.id, metadata: { status, via: "telegram" } });
    await ctx.answerCallbackQuery({ text: `Статус: ${TASK_STATUS_LABELS[status as "DONE"]}` });
    await ctx.editMessageReplyMarkup({ reply_markup: taskKeyboard(task.id, status!) }).catch(() => undefined);
  });

  bot.callbackQuery(/^participants:([a-z0-9]{10,40})$/, async (ctx) => {
    if (!ctx.linked?.can("events.manage")) return ctx.answerCallbackQuery({ text: "Недостаточно прав", show_alert: true });
    const [, eventId] = ctx.match as RegExpMatchArray;
    const event = await db.event.findUnique({
      where: { id: eventId },
      include: { participants: { include: { user: { select: { profile: true } } }, orderBy: { status: "asc" } } },
    });
    if (!event) return ctx.answerCallbackQuery({ text: "Не найдено" });
    await ctx.answerCallbackQuery();
    const lines = event.participants.map((p) => `${PARTICIPATION_LABELS[p.status]} — ${escapeHtml(p.user.profile ? fullName(p.user.profile) : "—")}`);
    await ctx.reply(`<b>${escapeHtml(event.title)}</b>\n${formatDateTime(event.startsAt)}\n\n${lines.join("\n") || "Участников пока нет"}`, html);
  });

  bot.callbackQuery(/^announce:(publish|cancel)$/, async (ctx) => {
    if (!ctx.linked?.can("announcements.manage") || !ctx.from) return ctx.answerCallbackQuery({ text: "Недостаточно прав", show_alert: true });
    const conv = await getConversation("TELEGRAM", BigInt(ctx.from.id));
    await ctx.answerCallbackQuery();
    if (!conv || conv.state !== ANNOUNCE_STATE) return ctx.reply("Черновик не найден, начните заново: /announce");
    await clearConversation("TELEGRAM", BigInt(ctx.from.id));
    if (ctx.match?.[1] === "cancel") return ctx.reply("Объявление отменено.", { reply_markup: mainKeyboard(ctx.linked) });
    const data = conv.data as { title: string; body: string; level: number };
    const a = await db.announcement.create({ data: { title: data.title, body: data.body, minRoleLevel: data.level, authorId: ctx.linked.id } });
    await audit({ actorId: ctx.linked.id, action: "announcement.create", entity: "Announcement", entityId: a.id, metadata: { via: "telegram" } });
    await notifyAudience(data.level, { type: "ANNOUNCEMENT", title: data.title, body: truncate(data.body, 500), url: "/cabinet/announcements", excludeUserId: ctx.linked.id });
    await ctx.reply("Объявление опубликовано и разослано ✅", { reply_markup: mainKeyboard(ctx.linked) });
  });

  // ── Свободный текст: многошаговые диалоги ──
  bot.on("message:text", async (ctx) => {
    if (!ctx.from) return;
    const conv = await getConversation("TELEGRAM", BigInt(ctx.from.id));
    if (conv?.state === ANNOUNCE_STATE) return announceStep(ctx, conv.data as Record<string, string | number>);
    await ctx.reply("Не понял 🙂 Выберите раздел в меню или наберите /help.", { reply_markup: mainKeyboard(ctx.linked) });
  });

  bot.catch((err) => log.error("bot error", { err: err.error, update: err.ctx.update.update_id }));
}

async function linkAccount(ctx: BotContext, code: string) {
  if (!ctx.from) return;
  const userId = await consumeLinkCode("TELEGRAM", code);
  if (!userId) {
    await ctx.reply("Ссылка привязки недействительна или устарела. Получите новую в личном кабинете → «Безопасность».");
    return;
  }
  const existing = await db.telegramAccount.findUnique({ where: { telegramUserId: BigInt(ctx.from.id) } });
  if (existing && existing.userId !== userId) {
    await ctx.reply("Этот Telegram уже привязан к другому аккаунту. Сначала отвяжите его (/unlink).");
    return;
  }
  await db.telegramAccount.upsert({
    where: { userId },
    create: { userId, telegramUserId: BigInt(ctx.from.id), username: ctx.from.username, firstName: ctx.from.first_name },
    update: { telegramUserId: BigInt(ctx.from.id), username: ctx.from.username, firstName: ctx.from.first_name, blockedBot: false, linkedAt: new Date() },
  });
  await audit({ actorId: userId, action: "integration.telegram_linked", entity: "User", entityId: userId, metadata: { telegramUserId: String(ctx.from.id) } });
  ctx.linked = await resolveLinkedUser(ctx.from.id);
  await ctx.reply("Готово! Telegram привязан к вашему аккаунту ✅\nТеперь уведомления будут приходить сюда.", { reply_markup: mainKeyboard(ctx.linked) });
}

async function profile(ctx: BotContext) {
  const u = ctx.linked;
  if (!u) return ctx.reply(NOT_LINKED);
  const lines = [
    `<b>${escapeHtml(u.profile ? fullName(u.profile) : u.email)}</b>`,
    `Роль: ${escapeHtml(u.role.name)}`,
    u.profile?.position ? `Должность: ${escapeHtml(u.profile.position)}` : null,
    u.profile?.squadStatus ? `Статус: ${escapeHtml(u.profile.squadStatus)}` : null,
    u.profile?.joinedYear ? `В отряде с ${u.profile.joinedYear}` : null,
    u.emailAccount?.status === "ACTIVE" ? `Почта: ${escapeHtml(u.emailAccount.address)}` : null,
  ].filter(Boolean);
  await ctx.reply(lines.join("\n"), { ...html, reply_markup: new InlineKeyboard().url("Профиль в кабинете", appUrl("/cabinet/profile")) });
}

async function events(ctx: BotContext) {
  if (!ctx.linked) return ctx.reply(NOT_LINKED);
  const list = await upcomingEventsForUser(ctx.linked, 5);
  if (list.length === 0) return ctx.reply("Ближайших мероприятий нет.");
  for (const e of list) {
    const my = e.participants[0]?.status;
    const text = [
      `<b>${escapeHtml(e.title)}</b>${e.status === "CANCELLED" ? " — ❌ отменено" : ""}`,
      `${EVENT_TYPE_LABELS[e.type]} · ${formatDateTime(e.startsAt)}`,
      e.location ? `📍 ${escapeHtml(e.location)}` : null,
      my ? `Твой ответ: ${PARTICIPATION_LABELS[my]}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const kb = e.requiresConfirmation && e.status !== "CANCELLED" ? rsvpKeyboard(e.id) : new InlineKeyboard();
    kb.row().url("Подробнее", appUrl(`/cabinet/events/${e.id}`));
    await ctx.reply(text, { ...html, reply_markup: kb });
  }
}

async function tasks(ctx: BotContext) {
  if (!ctx.linked) return ctx.reply(NOT_LINKED);
  const list = await openTasksForUser(ctx.linked.id, 10);
  if (list.length === 0) return ctx.reply("Открытых задач нет 🎉");
  for (const t of list) {
    const text = [`<b>${escapeHtml(t.title)}</b>`, `Статус: ${TASK_STATUS_LABELS[t.status]}`, t.dueAt ? `⏰ до ${formatDateTime(t.dueAt)}` : "Без срока"].join("\n");
    await ctx.reply(text, { ...html, reply_markup: taskKeyboard(t.id, t.status).row().url("Открыть", appUrl(`/cabinet/tasks/${t.id}`)) });
  }
}

async function announcements(ctx: BotContext) {
  if (!ctx.linked) return ctx.reply(NOT_LINKED);
  const list = await announcementsForLevel(ctx.linked.level, 5);
  if (list.length === 0) return ctx.reply("Объявлений нет.");
  const text = list
    .map((a) => `${a.pinned ? "📌 " : ""}<b>${escapeHtml(a.title)}</b>\n${escapeHtml(truncate(a.body.replace(/[#*_>`]/g, ""), 400))}`)
    .join("\n\n");
  await ctx.reply(text, { ...html, reply_markup: new InlineKeyboard().url("Все объявления", appUrl("/cabinet/announcements")) });
}

async function documents(ctx: BotContext) {
  if (!ctx.linked) return ctx.reply(NOT_LINKED);
  const list = await documentsForLevel(ctx.linked.level, 10);
  if (list.length === 0) return ctx.reply("Документов пока нет.");
  // Файлы не пересылаем в Telegram: скачивание — только в кабинете с проверкой прав.
  const text = list.map((d) => `• ${escapeHtml(d.title)} <i>(${escapeHtml(d.category.name)})</i>`).join("\n");
  await ctx.reply(`<b>Последние документы</b>\n${text}`, { ...html, reply_markup: new InlineKeyboard().url("Открыть документы", appUrl("/cabinet/documents")) });
}

async function contacts(ctx: BotContext) {
  const s = await getSettings(["site.contacts"]);
  const c = s["site.contacts"];
  const lines = ["<b>Контакты ТОП «Драго»</b>", c.vkUrl && `ВКонтакте: ${c.vkUrl}`, c.telegramUrl && `Telegram: ${c.telegramUrl}`, c.email && `Email: ${c.email}`, c.phone && `Телефон: ${c.phone}`, `Сайт: ${appUrl("/")}`].filter(Boolean);
  await ctx.reply(lines.join("\n"), html);
}

async function about(ctx: BotContext) {
  const s = await getSettings(["site.general"]);
  const g = s["site.general"];
  await ctx.reply(`<b>${escapeHtml(g.siteName)}</b>\n${escapeHtml(g.heroSubtitle)}\n\n<i>${escapeHtml(g.tagline)}</i>`, {
    ...html,
    reply_markup: new InlineKeyboard().url("Подробнее на сайте", appUrl("/about")),
  });
}

async function join(ctx: BotContext) {
  if (!ctx.from) return;
  if (ctx.linked) return ctx.reply("Ты уже в системе отряда 🙂");
  // Заявки принимает только МосРСО в своём приложении ВКонтакте — бот анкету не собирает.
  const { "site.general": g } = await getSettings(["site.general"]);
  await ctx.reply(`${escapeHtml(g.recruitmentText)}\n\nЗаявку принимает МосРСО в приложении ВКонтакте.`, {
    ...html,
    reply_markup: new InlineKeyboard().url("Подать заявку", g.joinUrl).row().url("Как всё устроено", appUrl("/join")),
  });
}

async function applications(ctx: BotContext) {
  if (!ctx.linked?.can("applications.read")) return ctx.reply("Недостаточно прав.");
  const list = await db.joinApplication.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "desc" }, take: 10 });
  if (list.length === 0) return ctx.reply("Новых заявок нет.");
  // Минимум ПДн в мессенджере: имя, возраст, источник. Контакты — в админ-панели.
  const text = list.map((a) => `• <b>${escapeHtml(a.fullName)}</b>, ${a.age} лет — ${APPLICATION_SOURCE_LABELS[a.source]}, ${formatDateTime(a.createdAt)}`).join("\n");
  await ctx.reply(`<b>Новые заявки (${list.length})</b>\n${text}`, { ...html, reply_markup: new InlineKeyboard().url("Открыть в админке", appUrl("/admin/applications?status=NEW")) });
}

async function participants(ctx: BotContext) {
  if (!ctx.linked?.can("events.manage")) return ctx.reply("Недостаточно прав.");
  const list = await db.event.findMany({ where: { startsAt: { gte: new Date(Date.now() - 86400_000) } }, orderBy: { startsAt: "asc" }, take: 8 });
  if (list.length === 0) return ctx.reply("Ближайших мероприятий нет.");
  const kb = new InlineKeyboard();
  list.forEach((e) => kb.text(truncate(`${formatDateTime(e.startsAt)} · ${e.title}`, 60), `participants:${e.id}`).row());
  await ctx.reply("Выберите мероприятие:", { reply_markup: kb });
}

async function announce(ctx: BotContext) {
  if (!ctx.linked?.can("announcements.manage") || !ctx.from) return ctx.reply("Недостаточно прав.");
  await setConversation("TELEGRAM", BigInt(ctx.from.id), ANNOUNCE_STATE, { step: "title" });
  await ctx.reply("Новое объявление. Напишите заголовок (или /cancel).");
}

async function announceStep(ctx: BotContext & { message?: { text?: string } }, data: Record<string, string | number>) {
  if (!ctx.from || !ctx.linked?.can("announcements.manage")) return;
  const text = ctx.message?.text?.trim() ?? "";
  const id = BigInt(ctx.from.id);
  if (data.step === "title") {
    if (text.length < 3 || text.length > 150) return ctx.reply("Заголовок: от 3 до 150 символов.");
    await setConversation("TELEGRAM", id, ANNOUNCE_STATE, { step: "body", title: text });
    return ctx.reply("Теперь текст объявления.");
  }
  if (data.step === "body") {
    if (text.length < 1 || text.length > 4000) return ctx.reply("Текст: до 4000 символов.");
    await setConversation("TELEGRAM", id, ANNOUNCE_STATE, { ...data, step: "audience", body: text });
    return ctx.reply(`Для кого объявление? Напишите номер:\n${AUDIENCES.map((a, i) => `${i + 1}. ${a.label}`).join("\n")}`);
  }
  if (data.step === "audience") {
    const aud = AUDIENCES[Number(text) - 1];
    if (!aud) return ctx.reply("Напишите номер аудитории из списка.");
    await setConversation("TELEGRAM", id, ANNOUNCE_STATE, { ...data, step: "confirm", level: aud.level });
    return ctx.reply(`<b>${escapeHtml(String(data.title))}</b>\n${escapeHtml(String(data.body))}\n\nАудитория: ${aud.label}`, {
      ...html,
      reply_markup: new InlineKeyboard().text("✅ Опубликовать", "announce:publish").text("Отмена", "announce:cancel"),
    });
  }
  return ctx.reply("Подтвердите публикацию кнопкой выше или /cancel.");
}
