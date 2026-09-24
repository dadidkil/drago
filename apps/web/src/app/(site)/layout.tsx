import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { getSession } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/content";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [settings, session] = await Promise.all([getSiteSettings(), getSession()]);
  return (
    <>
      <SiteHeader isLoggedIn={Boolean(session)} />
      <main id="main">{children}</main>
      <SiteFooter general={settings["site.general"]} contacts={settings["site.contacts"]} />
    </>
  );
}
