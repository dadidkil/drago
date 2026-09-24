import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@drago/database";
import { formatDate } from "@drago/shared";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { NewKnowledgeArticleForm } from "./forms";

export const metadata: Metadata = { title: "Контент сайта" };

export default async function PagesHub() {
  await requireAdmin("pages.manage");
  const [pages, team, projects, achievements, faq] = await Promise.all([
    db.page.findMany({ orderBy: { slug: "asc" } }),
    db.teamMember.count(),
    db.project.count(),
    db.achievement.count(),
    db.faqItem.count(),
  ]);
  const sections = [
    { href: "/admin/pages/contacts", title: "Главная и контакты", text: "Заголовок, слоган, набор, соцсети, контакты" },
    { href: "/admin/pages/team", title: "Командный состав", text: `Карточек: ${team}` },
    { href: "/admin/pages/projects", title: "Проекты", text: `Проектов: ${projects}` },
    { href: "/admin/pages/achievements", title: "Достижения", text: `Записей: ${achievements}` },
    { href: "/admin/pages/faq", title: "FAQ", text: `Вопросов: ${faq}` },
    { href: "/admin/gallery", title: "Галерея", text: "Альбомы и фото" },
    { href: "/admin/news", title: "Новости", text: "Публикации на сайте" },
  ];
  return (
    <>
      <PageHeader title="Контент сайта" description="Всё, что видно на dragotop.ru, редактируется здесь." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-2xl border border-line bg-white p-5 hover:border-fire/50">
            <p className="font-semibold">{s.title}</p>
            <p className="mt-1 text-sm text-muted">{s.text}</p>
          </Link>
        ))}
      </div>
      <h2 className="mt-8 mb-3 text-lg font-semibold">Страницы сайта</h2>
      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-line">
          {pages.filter((p) => !p.slug.startsWith("kb-")).map((p) => (
            <li key={p.slug} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <Link href={`/admin/pages/page/${p.slug}`} className="font-semibold hover:text-fire">
                  {p.title}
                </Link>
                <p className="text-xs text-muted">обновлено {formatDate(p.updatedAt)}</p>
              </div>
              <Badge tone={p.isPublished ? "success" : "warning"}>{p.isPublished ? "опубликована" : "черновик"}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <h2 id="knowledge" className="mt-8 mb-1 text-lg font-semibold">
        База знаний (только в кабинете)
      </h2>
      <p className="mb-3 text-sm text-muted">Внутренние материалы для бойцов — на сайте не публикуются.</p>
      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-line">
          {pages.filter((p) => p.slug.startsWith("kb-")).map((p) => (
            <li key={p.slug} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <Link href={`/admin/pages/page/${p.slug}`} className="font-semibold hover:text-fire">
                  {p.title}
                </Link>
                <p className="text-xs text-muted">/cabinet/knowledge/{p.slug.slice(3)} · обновлено {formatDate(p.updatedAt)}</p>
              </div>
              <Badge tone={p.isPublished ? "success" : "warning"}>{p.isPublished ? "видна бойцам" : "черновик"}</Badge>
            </li>
          ))}
        </ul>
        <div className="border-t border-line p-5">
          <NewKnowledgeArticleForm />
        </div>
      </Card>
    </>
  );
}
