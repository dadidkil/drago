import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/ui/markdown";
import { Container, PageHero } from "@/components/site/section";
import { getPublishedPage } from "@/lib/content";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const page = await getPublishedPage("privacy");
  if (!page) notFound();
  return (
    <>
      <PageHero eyebrow="Документы" title={page.title} />
      <Container className="max-w-3xl py-14 sm:py-20">
        <Markdown source={page.content} />
        <p className="mt-10 text-sm text-muted">Обновлено: {page.updatedAt.toLocaleDateString("ru-RU")}</p>
      </Container>
    </>
  );
}
