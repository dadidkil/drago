"use client";

import { AUDIENCES } from "@drago/shared";
import { AudienceSelect } from "@/components/admin/pickers";
import { ActionForm, Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { saveCategory, uploadDocument } from "./actions";

export function UploadDocumentForm({ categories }: { categories: { id: string; name: string }[] }) {
  return (
    <ActionForm action={uploadDocument} resetOnSuccess refreshOnSuccess className="grid gap-4">
      <FormMessage />
      <Field label="Название" name="title" required>
        <Input name="title" maxLength={200} />
      </Field>
      <Field label="Описание" name="description">
        <Input name="description" maxLength={1000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Категория" name="categoryId" required>
          <Select name="categoryId">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Доступ (строже категории)" name="minRoleLevel" hint="Пусто — как у категории">
          <Select name="minRoleLevel" defaultValue="">
            <option value="">Как у категории</option>
            {AUDIENCES.map((a) => (
              <option key={a.level} value={a.level}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Файл" name="file" required hint="PDF, DOCX, XLSX, PPTX, ODT/ODS/ODP или изображение, до 25 МБ. Тип проверяется по содержимому.">
        <Input name="file" type="file" className="py-2 text-sm" />
      </Field>
      <div>
        <SubmitButton pendingText="Загружаем…">Загрузить</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CategoryForm({ category }: { category?: { id: string; name: string; description: string | null; minRoleLevel: number; sortOrder: number } }) {
  return (
    // Раскладка зависит от ширины карточки (container query), а не экрана: карточка занимает половину страницы.
    // Узко — «доступ» на всю ширину (иначе обрезается текст), кнопка под ним справа; шире 28rem — в одну строку.
    <ActionForm action={saveCategory} resetOnSuccess={!category} refreshOnSuccess className="@container grid grid-cols-[minmax(0,1fr)_7rem] items-end gap-3">
      {category && <input type="hidden" name="id" value={category.id} />}
      <Field label="Категория" name="name">
        <Input name="name" defaultValue={category?.name} maxLength={80} placeholder={category ? undefined : "Новая категория"} />
      </Field>
      <Field label="Порядок" name="sortOrder">
        <Input name="sortOrder" type="number" defaultValue={category?.sortOrder ?? 0} />
      </Field>
      <Field label="Доступ" name="minRoleLevel" className="col-span-full @md:col-span-1">
        <AudienceSelect defaultValue={category?.minRoleLevel ?? 20} />
      </Field>
      <SubmitButton variant="secondary" size="sm" className="col-start-2 h-11 w-full @md:col-start-auto">
        {category ? "Сохранить" : "Добавить"}
      </SubmitButton>
      <FormMessage className="col-span-full" />
    </ActionForm>
  );
}
