import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { Container, PageHero } from "@/components/site/section";
import { getProject } from "@/lib/content";
import { mediaUrl } from "@/lib/uploads";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: project.coverFileId ? { images: [{ url: `/media/${project.coverFileId}` }] } : undefined,
  };
}

export default async function ProjectPage({ params }: Props) {
  const project = await getProject((await params).slug);
  if (!project) notFound();
  const cover = mediaUrl(project.coverFileId);
  return (
    <>
      <PageHero eyebrow={[project.partner, project.period].filter(Boolean).join(" · ") || "Проект"} title={project.title} lead={project.summary} />
      <Container className="max-w-4xl py-14 sm:py-20">
        {cover && (
          <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-2xl">
            <Image src={cover} alt="" fill sizes="(min-width:1024px) 900px, 100vw" className="object-cover" priority />
          </div>
        )}
        <Markdown source={project.description} />
        <Link href="/projects" className="mt-12 inline-flex items-center gap-2 font-semibold text-fire">
          <ArrowLeft className="size-4" aria-hidden /> Все проекты
        </Link>
      </Container>
    </>
  );
}
