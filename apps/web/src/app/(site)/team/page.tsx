import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/misc";
import { TeamCard } from "@/components/site/cards";
import { Container, PageHero } from "@/components/site/section";
import { getTeam } from "@/lib/content";

export const metadata: Metadata = {
  title: "Командный состав",
  description: "Командный состав ТОП «Драго»: командир, комиссар и люди, которые ведут отряд.",
  alternates: { canonical: "/team" },
};

export default async function TeamPage() {
  const team = await getTeam();
  return (
    <>
      <PageHero eyebrow="Команда" title="Командный состав" lead="Те, кто отвечает за работу, безопасность и атмосферу в отряде." />
      <Container className="py-14 sm:py-20">
        {team.length === 0 ? (
          <EmptyState title="Скоро здесь появится командный состав" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((m, i) => (
              <TeamCard key={m.id} member={m} index={i} />
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
