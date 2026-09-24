import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/misc";
import { ProjectCard } from "@/components/site/cards";
import { Container, PageHero } from "@/components/site/section";
import { getProjects } from "@/lib/content";

export const metadata: Metadata = {
  title: "Проекты",
  description: "Трудовые проекты ТОП «Драго»: где работают бойцы отряда.",
  alternates: { canonical: "/projects" },
};

export default async function ProjectsPage() {
  const projects = await getProjects();
  return (
    <>
      <PageHero eyebrow="Наши проекты" title="Где работают бойцы «Драго»" lead="Реальные объекты, реальная ответственность и опыт, который остаётся с тобой." />
      <Container className="py-14 sm:py-20">
        {projects.length === 0 ? (
          <EmptyState title="Проекты скоро появятся" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
