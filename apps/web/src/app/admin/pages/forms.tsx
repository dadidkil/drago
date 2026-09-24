"use client";

import { ActionForm, Checkbox, Field, FormMessage, Input, SubmitButton, Textarea } from "@/components/ui/form";
import {
  saveAchievement,
  saveFaq,
  savePage,
  saveProject,
  saveSiteContacts,
  saveSiteGeneral,
  saveTeamMember,
} from "./actions";

export function PageForm({ page }: { page: { slug: string; title: string; content: string; seoTitle: string | null; seoDescription: string | null; isPublished: boolean } }) {
  return (
    <ActionForm action={savePage} refreshOnSuccess className="grid gap-5">
      <input type="hidden" name="slug" value={page.slug} />
      <FormMessage />
      <Field label="Заголовок" name="title" required>
        <Input name="title" defaultValue={page.title} />
      </Field>
      <Field label="Текст" name="content" required hint="Markdown. Публикуйте только проверенные факты.">
        <Textarea name="content" defaultValue={page.content} rows={18} className="font-mono text-sm" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SEO-заголовок" name="seoTitle" hint="До 70 символов">
          <Input name="seoTitle" defaultValue={page.seoTitle ?? ""} maxLength={70} />
        </Field>
        <Field label="SEO-описание" name="seoDescription" hint="До 200 символов">
          <Input name="seoDescription" defaultValue={page.seoDescription ?? ""} maxLength={200} />
        </Field>
      </div>
      <Checkbox name="isPublished" defaultChecked={page.isPublished} label="Опубликовано на сайте" />
      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function TeamMemberForm({ m }: { m?: { id: string; fullName: string; position: string; bio: string | null; sortOrder: number; isPublished: boolean; photoFileId: string | null } }) {
  return (
    <ActionForm action={saveTeamMember} resetOnSuccess={!m} refreshOnSuccess className="grid gap-3">
      {m && <input type="hidden" name="id" value={m.id} />}
      <FormMessage />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem]">
        <Field label="Имя и фамилия" name="fullName" required>
          <Input name="fullName" defaultValue={m?.fullName} />
        </Field>
        <Field label="Должность" name="position" required>
          <Input name="position" defaultValue={m?.position} placeholder="Командир отряда" />
        </Field>
        <Field label="Порядок" name="sortOrder">
          <Input name="sortOrder" type="number" defaultValue={m?.sortOrder ?? 0} />
        </Field>
      </div>
      <Field label="Пара слов" name="bio">
        <Textarea name="bio" defaultValue={m?.bio ?? ""} rows={2} maxLength={1000} />
      </Field>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Фото" name="photo" hint="Публичное фото — только с согласия человека (и родителей, если ему нет 18)">
          <Input name="photo" type="file" accept="image/*" className="py-2 text-sm" />
        </Field>
        {m?.photoFileId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/media/${m.photoFileId}`} alt="" className="size-16 rounded-xl object-cover" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <Checkbox name="isPublished" defaultChecked={m?.isPublished ?? true} label="Показывать на сайте" />
        {m?.photoFileId && <Checkbox name="removePhoto" label="Удалить фото" />}
        <SubmitButton size="sm">{m ? "Сохранить" : "Добавить"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ProjectForm({
  p,
}: {
  p?: { id: string; title: string; slug: string; summary: string; description: string; partner: string | null; period: string | null; sortOrder: number; isPublished: boolean; coverFileId: string | null };
}) {
  return (
    <ActionForm action={saveProject} refreshOnSuccess className="grid gap-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <FormMessage />
      <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
        <Field label="Название" name="title" required>
          <Input name="title" defaultValue={p?.title} />
        </Field>
        <Field label="Адрес (slug)" name="slug" hint="Пусто — из названия">
          <Input name="slug" defaultValue={p?.slug} />
        </Field>
      </div>
      <Field label="Кратко" name="summary" required>
        <Input name="summary" defaultValue={p?.summary} maxLength={300} />
      </Field>
      <Field label="Описание" name="description" required hint="Markdown">
        <Textarea name="description" defaultValue={p?.description} rows={8} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Партнёр" name="partner">
          <Input name="partner" defaultValue={p?.partner ?? ""} />
        </Field>
        <Field label="Период" name="period">
          <Input name="period" defaultValue={p?.period ?? ""} placeholder="Лето 2026" />
        </Field>
        <Field label="Порядок" name="sortOrder">
          <Input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} />
        </Field>
      </div>
      <Field label="Обложка" name="cover">
        <Input name="cover" type="file" accept="image/*" className="py-2 text-sm" />
      </Field>
      <div className="flex flex-wrap items-center gap-5">
        <Checkbox name="isPublished" defaultChecked={p?.isPublished} label="Опубликовано" />
        {p?.coverFileId && <Checkbox name="removeCover" label="Удалить обложку" />}
      </div>
      <div>
        <SubmitButton>{p ? "Сохранить" : "Добавить проект"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AchievementForm({ a }: { a?: { id: string; title: string; description: string | null; year: number | null; sortOrder: number; isPublished: boolean } }) {
  return (
    <ActionForm action={saveAchievement} resetOnSuccess={!a} refreshOnSuccess className="grid gap-3">
      {a && <input type="hidden" name="id" value={a.id} />}
      <FormMessage />
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem_6rem]">
        <Field label="Достижение" name="title" required>
          <Input name="title" defaultValue={a?.title} />
        </Field>
        <Field label="Год" name="year">
          <Input name="year" type="number" defaultValue={a?.year ?? ""} />
        </Field>
        <Field label="Порядок" name="sortOrder">
          <Input name="sortOrder" type="number" defaultValue={a?.sortOrder ?? 0} />
        </Field>
      </div>
      <Field label="Описание" name="description">
        <Input name="description" defaultValue={a?.description ?? ""} />
      </Field>
      <div className="flex items-center gap-5">
        <Checkbox name="isPublished" defaultChecked={a?.isPublished ?? true} label="Опубликовано" />
        <SubmitButton size="sm">{a ? "Сохранить" : "Добавить"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function FaqForm({ f }: { f?: { id: string; question: string; answer: string; sortOrder: number; isPublished: boolean } }) {
  return (
    <ActionForm action={saveFaq} resetOnSuccess={!f} refreshOnSuccess className="grid gap-3">
      {f && <input type="hidden" name="id" value={f.id} />}
      <FormMessage />
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
        <Field label="Вопрос" name="question" required>
          <Input name="question" defaultValue={f?.question} />
        </Field>
        <Field label="Порядок" name="sortOrder">
          <Input name="sortOrder" type="number" defaultValue={f?.sortOrder ?? 0} />
        </Field>
      </div>
      <Field label="Ответ" name="answer" required hint="Markdown">
        <Textarea name="answer" defaultValue={f?.answer} rows={3} />
      </Field>
      <div className="flex items-center gap-5">
        <Checkbox name="isPublished" defaultChecked={f?.isPublished ?? true} label="Опубликовано" />
        <SubmitButton size="sm">{f ? "Сохранить" : "Добавить"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SiteGeneralForm({ g }: { g: { siteName: string; heroTitle: string; heroSubtitle: string; tagline: string; recruitmentOpen: boolean; recruitmentText: string } }) {
  return (
    <ActionForm action={saveSiteGeneral} className="grid gap-4">
      <FormMessage />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Название сайта" name="siteName">
          <Input name="siteName" defaultValue={g.siteName} />
        </Field>
        <Field label="Заголовок на главной" name="heroTitle" hint="Второе слово выделяется огненным градиентом">
          <Input name="heroTitle" defaultValue={g.heroTitle} />
        </Field>
      </div>
      <Field label="Подзаголовок на главной" name="heroSubtitle">
        <Textarea name="heroSubtitle" defaultValue={g.heroSubtitle} rows={2} />
      </Field>
      <Field label="Девиз / слоган" name="tagline">
        <Input name="tagline" defaultValue={g.tagline} />
      </Field>
      <Field label="Текст о наборе" name="recruitmentText">
        <Textarea name="recruitmentText" defaultValue={g.recruitmentText} rows={2} />
      </Field>
      <Checkbox name="recruitmentOpen" defaultChecked={g.recruitmentOpen} label="Набор открыт" />
      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SiteContactsForm({
  c,
}: {
  c: { email: string; phone: string; address: string; vkUrl: string; telegramUrl: string; note: string; extraLinks: { label: string; url: string }[] };
}) {
  return (
    <ActionForm action={saveSiteContacts} className="grid gap-4">
      <FormMessage />
      <p className="text-sm text-muted">Публикуйте только официальные контакты отряда — не личные телефоны и почту несовершеннолетних.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ВКонтакте" name="vkUrl">
          <Input name="vkUrl" type="url" defaultValue={c.vkUrl} placeholder="https://vk.com/top_drago" />
        </Field>
        <Field label="Telegram-канал" name="telegramUrl">
          <Input name="telegramUrl" type="url" defaultValue={c.telegramUrl} placeholder="https://t.me/…" />
        </Field>
        <Field label="Email отряда" name="email">
          <Input name="email" type="email" defaultValue={c.email} placeholder="info@dragotop.ru" />
        </Field>
        <Field label="Телефон (официальный)" name="phone">
          <Input name="phone" defaultValue={c.phone} />
        </Field>
      </div>
      <Field label="Адрес / где мы" name="address">
        <Input name="address" defaultValue={c.address} />
      </Field>
      <Field label="Подсказка для связи" name="note">
        <Input name="note" defaultValue={c.note} />
      </Field>
      <Field label="Дополнительные ссылки" name="extraLinks" hint="По одной в строке: Название | https://…">
        <Textarea name="extraLinks" defaultValue={c.extraLinks.map((l) => `${l.label} | ${l.url}`).join("\n")} rows={3} />
      </Field>
      <div>
        <SubmitButton>Сохранить контакты</SubmitButton>
      </div>
    </ActionForm>
  );
}
