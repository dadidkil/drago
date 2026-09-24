import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@drago/database";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { ProjectForm } from "../forms";

export const metadata: Metadata = { title: "Проекты" };

export default async function ProjectsAdmin() {
  await requireAdmin("pages.manage");
  const projects = await db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <>
      <PageHeader title="Проекты" description="Трудовые проекты отряда на сайте. Черновики не видны посетителям." />
      <ul className="mb-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div>
              <Link href={`/admin/pages/projects/${p.id}`} className="font-semibold hover:text-fire">
                {p.title}
              </Link>
              <p className="text-xs text-muted">{p.summary}</p>
            </div>
            <Badge tone={p.isPublished ? "success" : "warning"}>{p.isPublished ? "опубликован" : "черновик"}</Badge>
          </li>
        ))}
      </ul>
      <Card>
        <h2 className="mb-4 font-semibold">Новый проект</h2>
        <ProjectForm />
      </Card>
    </>
  );
}
