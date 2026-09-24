import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { TelegramIcon, VkIcon } from "@/components/site/brand";
import { Container, PageHero } from "@/components/site/section";
import { getSiteSettings } from "@/lib/content";

export const metadata: Metadata = {
  title: "Контакты",
  description: "Как связаться с ТОП «Драго»: сообщество ВКонтакте, Telegram, email.",
  alternates: { canonical: "/contacts" },
};

export default async function ContactsPage() {
  const contacts = (await getSiteSettings())["site.contacts"];
  const rows = [
    contacts.vkUrl && { icon: <VkIcon className="size-6" />, label: "ВКонтакте", value: contacts.vkUrl.replace(/^https?:\/\//, ""), href: contacts.vkUrl },
    contacts.telegramUrl && { icon: <TelegramIcon className="size-5" />, label: "Telegram", value: contacts.telegramUrl.replace(/^https?:\/\//, ""), href: contacts.telegramUrl },
    contacts.email && { icon: <Mail className="size-5" />, label: "Email", value: contacts.email, href: `mailto:${contacts.email}` },
    contacts.phone && { icon: <Phone className="size-5" />, label: "Телефон", value: contacts.phone, href: `tel:${contacts.phone.replace(/[^\d+]/g, "")}` },
    contacts.address && { icon: <MapPin className="size-5" />, label: "Где мы", value: contacts.address, href: null },
    ...contacts.extraLinks.map((l) => ({ icon: <ExternalLink className="size-5" />, label: l.label, value: l.url.replace(/^https?:\/\//, ""), href: l.url })),
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string; href: string | null }[];

  return (
    <>
      <PageHero eyebrow="Контакты" title="Связаться с «Драго»" lead={contacts.note} />
      <Container className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.4fr_1fr]">
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-4 p-5 sm:p-6">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-ink text-paper">{r.icon}</span>
              <div className="min-w-0">
                <p className="text-sm text-muted">{r.label}</p>
                {r.href ? (
                  <a
                    href={r.href}
                    className="font-semibold break-words hover:text-fire"
                    {...(r.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {r.value}
                  </a>
                ) : (
                  <p className="font-semibold">{r.value}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="bg-scales self-start rounded-2xl bg-ink p-6 text-paper sm:p-8">
          <h2 className="text-2xl font-semibold">Хочешь в отряд?</h2>
          <p className="mt-2 text-muted-dark">Оставь заявку — командный состав свяжется с тобой и пригласит на собеседование.</p>
          <Link href="/join" className={buttonClass("primary", "lg", "mt-6 w-full")}>
            Оставить заявку
          </Link>
        </div>
      </Container>
    </>
  );
}
