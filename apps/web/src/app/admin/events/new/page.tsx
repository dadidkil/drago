import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/misc";
import { activeUserOptions } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/current-user";
import { EventForm } from "../form";

export const metadata: Metadata = { title: "Новое мероприятие" };

export default async function NewEvent() {
  await requireAdmin("events.manage");
  return (
    <>
      <PageHeader title="Новое мероприятие" />
      <Card>
        <EventForm users={await activeUserOptions()} />
      </Card>
    </>
  );
}
