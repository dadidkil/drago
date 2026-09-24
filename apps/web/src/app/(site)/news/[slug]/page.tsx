import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@drago/shared";
import { Markdown } from "@/components/ui/markdown";
import { Container } from "@/components/site/section";
import { getNewsItem } from "@/lib/content";
import { markdownToText } from "@/lib/markdown";
import { getNonce } from "@/lib/request";
import { absoluteUrl } from "@/lib/site";
import { mediaUrl } from "@/lib/uploads";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await getNewsItem((await params).slug);
  if (!item) return {};
  const description = item.excerpt ?? markdownToText(item.content, 160);
  return {
    title: item.title,
    description,
    alternates: { canonical: `/news/${item.slug}` },
    openGraph: {
      type: "article",
      title: item.title,
      description,
      publishedTime: item.publishedAt?.toISOString(),
      images: item.coverFileId ? [{ url: `/media/${item.coverFileId}` }] : undefined,
    },
  };
}

export default async function NewsItemPage({ params }: Props) {
  const item = await getNewsItem((await params).slug);
  if (!item) notFound();
  const nonce = await getNonce();
  const cover = mediaUrl(item.coverFileId);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.title,
    datePublished: item.publishedAt?.toISOString(),
    dateModified: item.updatedAt.toISOString(),
    image: cover ? [absoluteUrl(cover)] : undefined,
    publisher: { "@type": "Organization", name: "ТОП «Драго»", logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") } },
    mainEntityOfPage: absoluteUrl(`/news/${item.slug}`),
  };
  return (
    <article>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Container className="max-w-3xl pt-10 pb-16 sm:pt-16 sm:pb-24">
        <Link href="/news" className="inline-flex items-center gap-2 text-sm font-semibold text-fire">
          <ArrowLeft className="size-4" aria-hidden /> Все новости
        </Link>
        {item.publishedAt && (
          <time dateTime={item.publishedAt.toISOString()} className="mt-8 block text-muted">
            {formatDate(item.publishedAt)}
          </time>
        )}
        <h1 className="mt-3 text-3xl leading-tight font-bold sm:text-5xl">{item.title}</h1>
        {item.excerpt && <p className="mt-5 text-xl leading-relaxed text-muted">{item.excerpt}</p>}
        {cover && (
          <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-2xl">
            <Image src={cover} alt="" fill priority sizes="(min-width:768px) 768px, 100vw" className="object-cover" />
          </div>
        )}
        <Markdown source={item.content} className="mt-10" />
      </Container>
    </article>
  );
}
