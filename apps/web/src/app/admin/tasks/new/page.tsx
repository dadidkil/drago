import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/misc";
import { activeUserOptions } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth/current-user";
import { TaskForm } from "../form";

export const metadata: Metadata = { title: "Новая задача" };

export default async function NewTask() {
  await requireAdmin("tasks.manage");
  return (
    <>
      <PageHeader title="Новая задача" />
      <Card className="max-w-3xl">
        <TaskForm users={await activeUserOptions()} />
      </Card>
    </>
  );
}
