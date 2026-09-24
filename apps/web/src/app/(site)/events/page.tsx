import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/misc";
import { EventList } from "@/components/site/cards";
import { Container, PageHero } from "@/components/site/section";
import { getPublicEvents } from "@/lib/content";
import { getNonce } from "@/lib/request";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Календарь событий",
  description: "Открытые мероприятия и события ТОП «Драго».",
  alternates: { canonical: "/events" },
};

export default async function EventsPage() {
  const [events, nonce] = await Promise.all([getPublicEvents(50), getNonce()]);
  const jsonLd = events.map((e) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    startDate: e.startsAt.toISOString(),
    endDate: e.endsAt?.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    location: e.location ? { "@type": "Place", name: e.location, address: e.location } : undefined,
    description: e.description ?? undefined,
    organizer: { "@type": "Organization", name: "ТОП «Драго»", url: absoluteUrl("/") },
  }));
  return (
    <>
      {events.length > 0 && (
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}
      <PageHero eyebrow="Календарь" title="События «Драго»" lead="Открытые мероприятия отряда. Внутренний календарь бойцов — в личном кабинете." />
      <Container className="max-w-4xl py-14 sm:py-20">
        {events.length === 0 ? (
          <EmptyState title="Ближайших открытых событий нет">Анонсы появятся здесь и в нашем сообществе ВКонтакте.</EmptyState>
        ) : (
          <EventList events={events} />
        )}
      </Container>
    </>
  );
}
