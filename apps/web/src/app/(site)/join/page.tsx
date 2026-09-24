import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { VkIcon } from "@/components/site/brand";
import { Container, PageHero } from "@/components/site/section";
import { getPublishedPage, getSiteSettings } from "@/lib/content";

export const metadata: Metadata = {
  title: "Вступить в отряд",
  description: "Как вступить в ТОП «Драго»: принимаем ребят 14–17 лет из школ и колледжей Москвы. Заявка — в приложении МосРСО ВКонтакте.",
  alternates: { canonical: "/join" },
};

/**
 * Сайт заявки не собирает: их принимает МосРСО в своём приложении ВКонтакте (ссылка — в настройках,
 * «Ссылка «Подать заявку»»). Здесь — как всё устроено и куда нажать.
 */
export default async function JoinPage() {
  const [settings, joinPage] = await Promise.all([getSiteSettings(), getPublishedPage("join")]);
  const general = settings["site.general"];
  const contacts = settings["site.contacts"];
  return (
    <>
      <PageHero eyebrow={general.recruitmentOpen ? "Набор открыт" : "Как вступить"} title="Вступить в «Драго»" lead={general.recruitmentText} />
      <Container className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
        {joinPage && (
          <section aria-labelledby="steps-title">
            <h2 id="steps-title" className="mb-5 text-2xl font-semibold">
              Как это работает
            </h2>
            <Markdown source={joinPage.content} />
          </section>
        )}
        <aside aria-labelledby="apply-title" className="self-start rounded-2xl border border-line bg-white p-6 sm:p-8">
          <h2 id="apply-title" className="text-2xl font-semibold">
            Подать заявку
          </h2>
          <p className="mt-3 text-muted">
            Заявки в трудовые отряды подростков Москвы принимает МосРСО — в своём приложении во ВКонтакте. Сайт «Драго» анкеты не собирает.
          </p>
          <a href={general.joinUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "lg", "mt-6 w-full")}>
            Подать заявку во ВКонтакте <ArrowUpRight className="size-5" aria-hidden />
          </a>
          {contacts.vkUrl && (
            <a href={contacts.vkUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "lg", "mt-3 w-full border border-line")}>
              <VkIcon className="size-5" /> Вопрос? Напиши нам
            </a>
          )}
        </aside>
      </Container>
    </>
  );
}
