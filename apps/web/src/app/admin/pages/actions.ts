"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@drago/database";
import { audit, setSetting } from "@drago/core";
import { slugify } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";
import { uniqueSlug } from "@/lib/admin";
import { deleteFileAsset, storeUpload } from "@/lib/uploads";

const P = "pages.manage" as const;
const refresh = () => revalidatePath("/", "layout");

// ── Страницы ──
export const savePage = userAction(
  {
    permission: P,
    schema: z.object({
      slug: z.enum(["about", "history", "traditions", "join", "privacy"]),
      title: zf.str(2, 150),
      content: zf.str(1, 50000, "Заполните текст"),
      seoTitle: zf.optStr(70),
      seoDescription: zf.optStr(200),
      isPublished: zf.bool(),
    }),
  },
  async (d, { user, ip }) => {
    const data = { title: d.title, content: d.content, seoTitle: d.seoTitle ?? null, seoDescription: d.seoDescription ?? null, isPublished: d.isPublished };
    await db.page.upsert({ where: { slug: d.slug }, create: { slug: d.slug, ...data }, update: data });
    await audit({ actorId: user.id, action: "page.update", entity: "Page", entityId: d.slug, ipAddress: ip, metadata: { published: d.isPublished } });
    refresh();
    return { ok: true, message: "Страница сохранена" };
  },
);

// ── Командный состав (публичные карточки) ──
export const saveTeamMember = userAction(
  {
    permission: P,
    schema: z.object({
      id: zf.id().optional(),
      fullName: zf.str(3, 100, "Укажите имя"),
      position: zf.str(2, 100, "Укажите должность"),
      bio: zf.optStr(1000),
      sortOrder: zf.optInt(0, 1000),
      isPublished: zf.bool(),
      photo: zf.file(),
      removePhoto: zf.bool(),
    }),
  },
  async (d, { user, ip }) => {
    const before = d.id ? await db.teamMember.findUnique({ where: { id: d.id } }) : null;
    let photoFileId = before?.photoFileId ?? null;
    const old = photoFileId;
    if (d.photo && d.photo.size > 0) photoFileId = (await storeUpload(d.photo, { kind: "image", visibility: "PUBLIC", uploadedById: user.id })).id;
    else if (d.removePhoto) photoFileId = null;
    const data = { fullName: d.fullName, position: d.position, bio: d.bio ?? null, sortOrder: d.sortOrder ?? 0, isPublished: d.isPublished, photoFileId };
    const m = d.id ? await db.teamMember.update({ where: { id: d.id }, data }) : await db.teamMember.create({ data });
    if (old && old !== photoFileId) await deleteFileAsset(old);
    await audit({ actorId: user.id, action: d.id ? "team.update" : "team.create", entity: "TeamMember", entityId: m.id, ipAddress: ip });
    refresh();
    return { ok: true, message: "Сохранено" };
  },
);

export const deleteTeamMember = userAction({ permission: P, schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const m = await db.teamMember.delete({ where: { id: d.id } });
  if (m.photoFileId) await deleteFileAsset(m.photoFileId);
  await audit({ actorId: user.id, action: "team.delete", entity: "TeamMember", entityId: d.id, ipAddress: ip });
  refresh();
  return { ok: true };
});

// ── Проекты ──
export const saveProject = userAction(
  {
    permission: P,
    schema: z.object({
      id: zf.id().optional(),
      title: zf.str(2, 150),
      slug: zf.slug(),
      summary: zf.str(5, 300, "Короткое описание"),
      description: zf.str(1, 20000, "Описание"),
      partner: zf.optStr(150),
      period: zf.optStr(100),
      sortOrder: zf.optInt(0, 1000),
      isPublished: zf.bool(),
      cover: zf.file(),
      removeCover: zf.bool(),
    }),
  },
  async (d, { user, ip }) => {
    const before = d.id ? await db.project.findUnique({ where: { id: d.id } }) : null;
    const slug = await uniqueSlug(d.slug ?? slugify(d.title), async (s) => {
      const f = await db.project.findUnique({ where: { slug: s }, select: { id: true } });
      return Boolean(f && f.id !== d.id);
    });
    let coverFileId = before?.coverFileId ?? null;
    const old = coverFileId;
    if (d.cover && d.cover.size > 0) coverFileId = (await storeUpload(d.cover, { kind: "image", visibility: "PUBLIC", uploadedById: user.id })).id;
    else if (d.removeCover) coverFileId = null;
    const data = {
      title: d.title,
      slug,
      summary: d.summary,
      description: d.description,
      partner: d.partner ?? null,
      period: d.period ?? null,
      sortOrder: d.sortOrder ?? 0,
      isPublished: d.isPublished,
      coverFileId,
    };
    const p = d.id ? await db.project.update({ where: { id: d.id }, data }) : await db.project.create({ data });
    if (old && old !== coverFileId) await deleteFileAsset(old);
    await audit({ actorId: user.id, action: d.id ? "project.update" : "project.create", entity: "Project", entityId: p.id, ipAddress: ip });
    refresh();
    if (!d.id) redirect(`/admin/pages/projects/${p.id}`);
    return { ok: true, message: "Сохранено" };
  },
);

export const deleteProject = userAction({ permission: P, schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  const p = await db.project.delete({ where: { id: d.id } });
  if (p.coverFileId) await deleteFileAsset(p.coverFileId);
  await audit({ actorId: user.id, action: "project.delete", entity: "Project", entityId: d.id, ipAddress: ip });
  refresh();
  redirect("/admin/pages/projects");
});

// ── Достижения ──
export const saveAchievement = userAction(
  {
    permission: P,
    schema: z.object({ id: zf.id().optional(), title: zf.str(2, 200), description: zf.optStr(500), year: zf.optInt(1990, 2100), sortOrder: zf.optInt(0, 1000), isPublished: zf.bool() }),
  },
  async (d, { user, ip }) => {
    const data = { title: d.title, description: d.description ?? null, year: d.year ?? null, sortOrder: d.sortOrder ?? 0, isPublished: d.isPublished };
    const a = d.id ? await db.achievement.update({ where: { id: d.id }, data }) : await db.achievement.create({ data });
    await audit({ actorId: user.id, action: d.id ? "achievement.update" : "achievement.create", entity: "Achievement", entityId: a.id, ipAddress: ip });
    refresh();
    return { ok: true, message: "Сохранено" };
  },
);

export const deleteAchievement = userAction({ permission: P, schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  await db.achievement.delete({ where: { id: d.id } });
  await audit({ actorId: user.id, action: "achievement.delete", entity: "Achievement", entityId: d.id, ipAddress: ip });
  refresh();
  return { ok: true };
});

// ── FAQ ──
export const saveFaq = userAction(
  { permission: P, schema: z.object({ id: zf.id().optional(), question: zf.str(3, 300), answer: zf.str(1, 5000), sortOrder: zf.optInt(0, 1000), isPublished: zf.bool() }) },
  async (d, { user, ip }) => {
    const data = { question: d.question, answer: d.answer, sortOrder: d.sortOrder ?? 0, isPublished: d.isPublished };
    const f = d.id ? await db.faqItem.update({ where: { id: d.id }, data }) : await db.faqItem.create({ data });
    await audit({ actorId: user.id, action: d.id ? "faq.update" : "faq.create", entity: "FaqItem", entityId: f.id, ipAddress: ip });
    refresh();
    return { ok: true, message: "Сохранено" };
  },
);

export const deleteFaq = userAction({ permission: P, schema: z.object({ id: zf.id() }) }, async (d, { user, ip }) => {
  await db.faqItem.delete({ where: { id: d.id } });
  await audit({ actorId: user.id, action: "faq.delete", entity: "FaqItem", entityId: d.id, ipAddress: ip });
  refresh();
  return { ok: true };
});

// ── Контакты и главная ──
export const saveSiteGeneral = userAction(
  {
    permission: P,
    schema: z.object({
      siteName: zf.str(1, 80),
      heroTitle: zf.str(1, 80),
      heroSubtitle: zf.str(1, 300),
      tagline: zf.str(1, 200),
      recruitmentOpen: zf.bool(),
      recruitmentText: zf.str(1, 500),
    }),
  },
  async (d, { user, ip }) => {
    await setSetting("site.general", d, { id: user.id, ip });
    refresh();
    return { ok: true, message: "Сохранено" };
  },
);

const optUrl = z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.union([z.literal(""), z.url({ message: "Неверная ссылка", protocol: /^https$/ })]));

export const saveSiteContacts = userAction(
  {
    permission: P,
    schema: z.object({
      email: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.union([z.literal(""), z.email("Неверный email")])),
      phone: z.string().trim().max(40),
      address: z.string().trim().max(200),
      vkUrl: optUrl,
      telegramUrl: optUrl,
      note: z.string().trim().max(500),
      extraLinks: z.string().max(3000).default(""),
    }),
  },
  async (d, { user, ip }) => {
    // Доп. ссылки: по одной в строке «Название | https://…»
    const extraLinks = d.extraLinks
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 10)
      .map((l) => {
        const [label, url] = l.split("|").map((x) => x.trim());
        if (!label || !url || !/^https:\/\//.test(url)) throw new UserError(`Неверная строка ссылки: «${l}»`, { extraLinks: "Формат: Название | https://…" });
        return { label: label.slice(0, 60), url };
      });
    await setSetting("site.contacts", { ...d, extraLinks }, { id: user.id, ip });
    refresh();
    return { ok: true, message: "Контакты сохранены" };
  },
);
