import type { Metadata } from "next";
import { getSettings } from "@drago/core";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { SiteContactsForm, SiteGeneralForm } from "../forms";

export const metadata: Metadata = { title: "Главная и контакты" };

export default async function ContactsAdmin() {
  await requireAdmin("pages.manage");
  const s = await getSettings(["site.general", "site.contacts"]);
  return (
    <>
      <PageHeader title="Главная и контакты" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Главная страница</h2>
          <SiteGeneralForm g={s["site.general"]} />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Контакты и соцсети</h2>
          <SiteContactsForm c={s["site.contacts"]} />
        </Card>
      </div>
    </>
  );
}
