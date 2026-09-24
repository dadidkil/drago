import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/misc";
import { NewsCard } from "@/components/site/cards";
import { Container, PageHero } from "@/components/site/section";
import { getNewsPage } from "@/lib/content";

export const metadata: Metadata = {
  title: "Новости",
  description: "Новости ТОП «Драго»: события, проекты и жизнь отряда.",
  alternates: { canonical: "/news" },
};

type Props = { searchParams: Promise<{ page?: string }> };

export default async function NewsPage({ searchParams }: Props) {
  const page = Math.max(1, Math.min(1000, Number((await searchParams).page) || 1));
  const { items, pages } = await getNewsPage(page);
  return (
    <>
      <PageHero eyebrow="Новости" title="Что происходит в «Драго»" />
      <Container className="py-14 sm:py-20">
        {items.length === 0 ? (
          <EmptyState title="Новостей пока нет">Следите за нами ВКонтакте — там всё самое свежее.</EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((n, i) => (
              <NewsCard key={n.id} item={n} index={i} />
            ))}
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Страницы новостей" className="mt-12 flex flex-wrap justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={p === 1 ? "/news" : `/news?page=${p}`}
                aria-current={p === page ? "page" : undefined}
                className={`inline-flex size-11 items-center justify-center rounded-xl font-semibold ${p === page ? "bg-ink text-paper" : "bg-white hover:bg-paper-2"}`}
              >
                {p}
              </Link>
            ))}
          </nav>
        )}
      </Container>
    </>
  );
}
