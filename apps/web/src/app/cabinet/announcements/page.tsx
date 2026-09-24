import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { announcementsForLevel } from "@drago/core";
import { AnnouncementCard } from "@/components/cabinet/items";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Объявления" };

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const items = await announcementsForLevel(user.level, 100);
  return (
    <>
      <PageHeader
        title="Объявления"
        description="Важное от командного состава."
        actions={user.can("announcements.manage") ? <ButtonLink href="/admin/announcements/new" size="sm">Новое объявление</ButtonLink> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState title="Объявлений пока нет" icon={<Megaphone className="size-8" />} />
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <AnnouncementCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </>
  );
}
