import { db, type LinkChannel, type Prisma } from "@drago/database";
import { joinApplicationSchema } from "@drago/shared";
import { createJoinApplication } from "./applications";

/**
 * Пошаговая анкета вступления в мессенджере (VK/Telegram) — общий конечный автомат.
 * Состояние хранится в BotConversation (TTL 30 минут). Ответ — текст и варианты быстрых ответов.
 */

export type JoinStep = "fullName" | "age" | "contact" | "school" | "comment" | "consent";
const ORDER: JoinStep[] = ["fullName", "age", "contact", "school", "comment", "consent"];
const TTL_MS = 30 * 60_000;
export const JOIN_STATE = "join";

export interface DialogReply {
  text: string;
  /** Варианты быстрых ответов (кнопки). */
  options?: { label: string; value: string }[];
  done?: boolean;
}

const PROMPTS: Record<JoinStep, DialogReply> = {
  fullName: { text: "Напиши, пожалуйста, фамилию и имя.", options: [{ label: "Отмена", value: "отмена" }] },
  age: { text: "Сколько тебе лет? (в ТОП принимают ребят 14–17 лет)", options: [{ label: "Отмена", value: "отмена" }] },
  contact: { text: "Телефон или email для связи — по нему командный состав свяжется с тобой.", options: [{ label: "Отмена", value: "отмена" }] },
  school: { text: "В какой школе или колледже учишься? Можно пропустить.", options: [{ label: "Пропустить", value: "-" }, { label: "Отмена", value: "отмена" }] },
  comment: { text: "Пара слов о себе или вопрос командному составу. Можно пропустить.", options: [{ label: "Пропустить", value: "-" }, { label: "Отмена", value: "отмена" }] },
  consent: {
    text:
      "Последний шаг. Подтверди, что согласен(на) на обработку персональных данных (политика: dragotop.ru/privacy) и что родители знают о заявке.",
    options: [
      { label: "Согласен(на)", value: "да" },
      { label: "Отмена", value: "отмена" },
    ],
  },
};

type Data = Record<string, string | number>;

function validateStep(step: JoinStep, input: string): { value?: string | number; error?: string } {
  const skip = input === "-" || /^пропустить$/i.test(input);
  const shape = joinApplicationSchema.shape;
  switch (step) {
    case "fullName": {
      const r = shape.fullName.safeParse(input);
      return r.success ? { value: r.data } : { error: r.error.issues[0]?.message };
    }
    case "age": {
      const r = shape.age.safeParse(input);
      return r.success ? { value: r.data } : { error: r.error.issues[0]?.message };
    }
    case "contact": {
      const r = shape.contact.safeParse(input);
      return r.success ? { value: r.data } : { error: r.error.issues[0]?.message };
    }
    case "school":
    case "comment": {
      if (skip) return { value: "" };
      const r = shape[step].safeParse(input);
      return r.success ? { value: r.data ?? "" } : { error: r.error.issues[0]?.message };
    }
    case "consent":
      return /^(да|согласен|согласна|согласен\(на\)|yes)$/i.test(input) ? { value: "yes" } : { error: "Без согласия заявку отправить нельзя. Нажми «Согласен(на)» или «Отмена»." };
  }
}

export async function getConversation(channel: LinkChannel, externalUserId: bigint) {
  const conv = await db.botConversation.findUnique({ where: { channel_externalUserId: { channel, externalUserId } } });
  if (!conv || conv.expiresAt < new Date()) return null;
  return conv;
}

export async function setConversation(channel: LinkChannel, externalUserId: bigint, state: string, data: Prisma.InputJsonValue) {
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.botConversation.upsert({
    where: { channel_externalUserId: { channel, externalUserId } },
    create: { channel, externalUserId, state, data, expiresAt },
    update: { state, data, expiresAt },
  });
}

export async function clearConversation(channel: LinkChannel, externalUserId: bigint) {
  await db.botConversation.deleteMany({ where: { channel, externalUserId } });
}

export async function startJoinDialog(channel: LinkChannel, externalUserId: bigint, prefill: Data = {}): Promise<DialogReply> {
  await setConversation(channel, externalUserId, JOIN_STATE, { step: "fullName", ...prefill });
  return {
    text: `Отлично! Заполним короткую анкету — 6 вопросов. Мы собираем только то, что нужно, чтобы связаться с тобой.\n\n${PROMPTS.fullName.text}`,
    options: PROMPTS.fullName.options,
  };
}

/** Обработать ответ пользователя в анкете. */
export async function handleJoinInput(
  channel: LinkChannel,
  externalUserId: bigint,
  data: Data,
  rawInput: string,
  meta: { vk?: string; telegram?: string },
): Promise<DialogReply> {
  const input = rawInput.trim().slice(0, 1000);
  if (/^(отмена|cancel|\/cancel|стоп)$/i.test(input)) {
    await clearConversation(channel, externalUserId);
    return { text: "Анкета отменена. Если передумаешь — просто нажми «Вступить»." };
  }
  const step = (data.step as JoinStep) ?? "fullName";
  const result = validateStep(step, input);
  if (result.error) return { text: `${result.error}\n\n${PROMPTS[step].text}`, options: PROMPTS[step].options };

  const next = { ...data, [step]: result.value! };
  const idx = ORDER.indexOf(step);
  if (idx < ORDER.length - 1) {
    const nextStep = ORDER[idx + 1]!;
    await setConversation(channel, externalUserId, JOIN_STATE, { ...next, step: nextStep });
    return PROMPTS[nextStep];
  }

  const parsed = joinApplicationSchema.safeParse({
    fullName: next.fullName,
    age: next.age,
    contact: next.contact,
    school: next.school || undefined,
    comment: next.comment || undefined,
    vk: meta.vk,
    telegram: meta.telegram,
  });
  await clearConversation(channel, externalUserId);
  if (!parsed.success) return { text: "Что-то не так с анкетой. Попробуй заполнить её на сайте: https://dragotop.ru/join" };
  await createJoinApplication(parsed.data, {
    source: channel === "VK" ? "VK_BOT" : "TELEGRAM_BOT",
    vkUserId: channel === "VK" ? externalUserId : null,
  });
  return { text: "Заявка отправлена! 🔥 Командный состав свяжется с тобой по указанным контактам. Спасибо!", done: true };
}
