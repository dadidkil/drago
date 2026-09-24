import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { AnnouncementForm } from "../form";

export const metadata: Metadata = { title: "Новое объявление" };

export default async function NewAnnouncement() {
  await requireAdmin("announcements.manage");
  return (
    <>
      <PageHeader title="Новое объявление" />
      <Card className="max-w-3xl">
        <AnnouncementForm />
      </Card>
    </>
  );
}
