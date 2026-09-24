import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@drago/database";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { AnnouncementForm } from "../form";

export const metadata: Metadata = { title: "Объявление" };

export default async function EditAnnouncement({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("announcements.manage");
  const item = await db.announcement.findUnique({ where: { id: (await params).id }, include: { attachments: { select: { id: true, originalName: true } } } });
  if (!item) notFound();
  return (
    <>
      <PageHeader title="Редактирование объявления" />
      <Card className="max-w-3xl">
        <AnnouncementForm item={item} />
      </Card>
    </>
  );
}
