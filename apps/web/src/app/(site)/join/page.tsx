import type { Metadata } from "next";
import { Markdown } from "@/components/ui/markdown";
import { VkIcon } from "@/components/site/brand";
import { Container, PageHero } from "@/components/site/section";
import { getPublishedPage, getSiteSettings } from "@/lib/content";
import { JoinForm } from "./join-form";

export const metadata: Metadata = {
  title: "Вступить в отряд",
  description: "Анкета для вступления в ТОП «Драго». Принимаем ребят 14–17 лет из школ и колледжей Москвы.",
  alternates: { canonical: "/join" },
};

export default async function JoinPage() {
  const [settings, joinPage] = await Promise.all([getSiteSettings(), getPublishedPage("join")]);
  const general = settings["site.general"];
  const contacts = settings["site.contacts"];
  return (
    <>
      <PageHero
        eyebrow={general.recruitmentOpen ? "Набор открыт" : "Заявка"}
        title="Вступить в «Драго»"
        lead={general.recruitmentText}
      />
      <Container className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-8">
          {joinPage && (
            <section aria-labelledby="steps-title">
              <h2 id="steps-title" className="mb-5 text-2xl font-semibold">
                Как это работает
              </h2>
              <Markdown source={joinPage.content} />
            </section>
          )}
          <div className="rounded-2xl border border-line bg-white p-6">
            <p className="font-semibold">Собираем только необходимое</p>
            <p className="mt-2 text-sm text-muted">
              Имя, возраст и контакт — чтобы связаться с тобой. Никаких паспортных данных и адресов. Заявки хранятся ограниченный срок и видны только
              командному составу.
            </p>
          </div>
          {contacts.vkUrl && (
            <a href={contacts.vkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-fire">
              <VkIcon className="size-5" /> Удобнее во ВКонтакте? Напиши сообществу — бот примет заявку там.
            </a>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 sm:p-8">
          <h2 className="mb-6 text-2xl font-semibold">Анкета</h2>
          <JoinForm />
        </div>
      </Container>
    </>
  );
}
