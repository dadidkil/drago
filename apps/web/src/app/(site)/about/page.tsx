import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { ELEMENTS } from "@/components/site/brand";
import { Container, PageHero } from "@/components/site/section";
import { getPublishedPage, getSiteSettings } from "@/lib/content";
import { markdownToText } from "@/lib/markdown";

export async function generateMetadata(): Promise<Metadata> {
  const about = await getPublishedPage("about");
  return {
    title: "О нас",
    description: about?.seoDescription ?? markdownToText(about?.content, 160),
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const [about, history, traditions, rso, settings] = await Promise.all([
    getPublishedPage("about"),
    getPublishedPage("history"),
    getPublishedPage("traditions"),
    getPublishedPage("rso"),
    getSiteSettings(),
  ]);
  const general = settings["site.general"];

  return (
    <>
      <PageHero eyebrow="О нас" title="ТОП «Драго»" lead={general.tagline} />
      <Container className="py-14 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-16">
            {about && (
              <section aria-labelledby="about-title">
                <h2 id="about-title" className="mb-6 text-3xl font-semibold">
                  {about.title}
                </h2>
                <Markdown source={about.content} />
              </section>
            )}
            {history && (
              <section id="history" aria-labelledby="history-title">
                <h2 id="history-title" className="mb-6 text-3xl font-semibold">
                  {history.title}
                </h2>
                <Markdown source={history.content} />
              </section>
            )}
            {rso && (
              <section id="rso" aria-labelledby="rso-title">
                <h2 id="rso-title" className="mb-6 text-3xl font-semibold">
                  {rso.title}
                </h2>
                <Markdown source={rso.content} />
              </section>
            )}
            {traditions && (
              <section id="traditions" aria-labelledby="traditions-title">
                <h2 id="traditions-title" className="mb-6 text-3xl font-semibold">
                  {traditions.title}
                </h2>
                <Markdown source={traditions.content} />
              </section>
            )}
          </div>
          <aside className="space-y-4 self-start lg:sticky lg:top-24">
            <div className="bg-scales rounded-2xl bg-ink p-6 text-paper">
              <p className="text-xs font-semibold tracking-[0.16em] text-fire-bright uppercase">Четыре стихии</p>
              <ul className="mt-4 space-y-3">
                {ELEMENTS.map((el) => (
                  <li key={el.key} className="flex items-center gap-3">
                    <span className={`size-3 rounded-full ${el.bg}`} aria-hidden />
                    <span className={`font-display font-semibold ${el.color}`}>{el.label}</span>
                    <span className="text-sm text-muted-dark">— {el.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/join" className={buttonClass("primary", "lg", "w-full")}>
              Вступить в отряд <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link href="/team" className={buttonClass("secondary", "lg", "w-full")}>
              Командный состав
            </Link>
          </aside>
        </div>
      </Container>
    </>
  );
}
