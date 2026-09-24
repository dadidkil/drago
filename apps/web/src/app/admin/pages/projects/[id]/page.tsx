import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@drago/database";
import { InlineAction } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteProject } from "../../actions";
import { ProjectForm } from "../../forms";

export const metadata: Metadata = { title: "Проект" };

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("pages.manage");
  const p = await db.project.findUnique({ where: { id: (await params).id } });
  if (!p) notFound();
  return (
    <>
      <Link href="/admin/pages/projects" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> Проекты
      </Link>
      <PageHeader title={p.title} actions={<InlineAction action={deleteProject} fields={{ id: p.id }} label="Удалить" variant="danger" confirm="Удалить проект?" />} />
      <Card>
        <ProjectForm p={p} />
      </Card>
    </>
  );
}
