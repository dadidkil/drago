import Link from "next/link";
import { ArrowUpRight, Trophy } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { TelegramIcon, VkIcon } from "@/components/site/brand";
import { EventList, FaqList, NewsCard, PhotoGrid, ProjectCard, TeamCard } from "@/components/site/cards";
import { Hero } from "@/components/site/hero";
import { Container, Section } from "@/components/site/section";
import { getSession } from "@/lib/auth/session";
import {
  getAchievements,
  getFaq,
  getLatestNews,
  getLatestPhotos,
  getProjects,
  getPublicEvents,
  getPublishedPage,
  getSiteSettings,
  getTeam,
} from "@/lib/content";
import { getNonce } from "@/lib/request";
import { absoluteUrl } from "@/lib/site";

export default async function HomePage() {
  const [settings, session, about, history, joinPage, team, projects, achievements, photos, news, events, faq, nonce] =
    await Promise.all([
      getSiteSettings(),
      getSession(),
      getPublishedPage("about"),
      getPublishedPage("history"),
      getPublishedPage("join"),
      getTeam(),
      getProjects(),
      getAchievements(),
      getLatestPhotos(8),
      getLatestNews(3),
      getPublicEvents(4),
      getFaq(),
      getNonce(),
    ]);
  const general = settings["site.general"];
  const contacts = settings["site.contacts"];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ТОП «Драго»",
    alternateName: "Трудовой отряд подростков «Драго»",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon.svg"),
    description: general.heroSubtitle,
    areaServed: "Москва",
    parentOrganization: { "@type": "Organization", name: "Российские Студенческие Отряды" },
    sameAs: [contacts.vkUrl, contacts.telegramUrl, ...contacts.extraLinks.map((l) => l.url)].filter(Boolean),
    ...(contacts.email ? { email: contacts.email } : {}),
  };

  return (
    <>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero
        title={general.heroTitle}
        subtitle={general.heroSubtitle}
        tagline={general.tagline}
        recruitmentOpen={general.recruitmentOpen}
        isLoggedIn={Boolean(session)}
      />

      {about && (
        <Section id="about" eyebrow="О нас" title="Отряд, где первая работа становится общим делом" more={{ href: "/about", label: "Подробнее об отряде" }}>
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
            <Markdown source={about.content} className="text-lg" />
            <div className="grid gap-4 self-start sm:grid-cols-2 lg:grid-cols-1">
              {[
                { k: "14–17", v: "возраст бойцов", c: "from-[#ff6a3d] to-[#c93510]" },
                { k: "Москва", v: "трудовые объекты города", c: "from-[#4fb3ff] to-[#1769aa]" },
                { k: "РСО", v: "часть большого движения", c: "from-[#a9a4ff] to-[#5b54c9]" },
              ].map((s) => (
                <div key={s.k} className={`rounded-2xl bg-gradient-to-br ${s.c} p-6 text-white`}>
                  <p className="font-display text-3xl font-bold">{s.k}</p>
                  <p className="mt-1 text-white/85">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {history && (
        <Section id="history" eyebrow="История" title={history.title} className="bg-paper-2" more={{ href: "/about#history", label: "Вся история" }}>
          <Markdown source={history.content} className="max-w-3xl" />
        </Section>
      )}

      {team.length > 0 && (
        <Section id="team" eyebrow="Командный состав" title="Люди, которые ведут «Драго»" more={{ href: "/team", label: "Весь командный состав" }}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.slice(0, 4).map((m, i) => (
              <TeamCard key={m.id} member={m} index={i} />
            ))}
          </div>
        </Section>
      )}

      {projects.length > 0 && (
        <Section id="projects" eyebrow="Наши проекты" title="Где работают бойцы" dark more={{ href: "/projects", label: "Все проекты" }}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
          </div>
        </Section>
      )}

      {achievements.length > 0 && (
        <Section id="achievements" eyebrow="Достижения" title="Чем мы гордимся">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a) => (
              <li key={a.id} className="flex gap-4 rounded-2xl border border-line bg-white p-5">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-fire-soft text-fire">
                  <Trophy className="size-6" aria-hidden />
                </span>
                <div>
                  {a.year && <p className="text-sm font-semibold text-fire">{a.year}</p>}
                  <p className="font-semibold">{a.title}</p>
                  {a.description && <p className="mt-1 text-sm text-muted">{a.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {photos.length > 0 && (
        <Section id="gallery" eyebrow="Галерея" title="Жизнь отряда" className="bg-paper-2" more={{ href: "/gallery", label: "Все альбомы" }}>
          <PhotoGrid photos={photos} />
        </Section>
      )}

      {news.length > 0 && (
        <Section id="news" eyebrow="Новости" title="Что происходит в «Драго»" more={{ href: "/news", label: "Все новости" }}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((n, i) => (
              <NewsCard key={n.id} item={n} index={i} />
            ))}
          </div>
        </Section>
      )}

      {events.length > 0 && (
        <Section id="events" eyebrow="Календарь" title="Ближайшие события" className="bg-paper-2" more={{ href: "/events", label: "Все события" }}>
          <EventList events={events} />
        </Section>
      )}

      <Section id="join" eyebrow="Как вступить" title="Стань частью «Драго»" dark lead={general.recruitmentText}>
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          {joinPage && <Markdown source={joinPage.content} className="prose-invert-drago text-lg [&_a]:text-fire-bright" />}
          <div className="self-start rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <p className="font-display text-2xl font-semibold">
              {general.recruitmentOpen ? "Набор открыт" : "Набор скоро откроется"}
            </p>
            <p className="mt-2 text-muted-dark">Заявки в трудовые отряды подростков принимает МосРСО в своём приложении ВКонтакте.</p>
            <a href={general.joinUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "lg", "mt-6 w-full")}>
              Подать заявку <ArrowUpRight className="size-5" aria-hidden />
            </a>
            {contacts.vkUrl && (
              <a href={contacts.vkUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("outline-light", "lg", "mt-3 w-full")}>
                <VkIcon className="size-5" /> Написать ВКонтакте
              </a>
            )}
          </div>
        </div>
      </Section>

      {faq.length > 0 && (
        <Section id="faq" eyebrow="FAQ" title="Частые вопросы">
          <div className="max-w-4xl">
            <FaqList items={faq} />
          </div>
        </Section>
      )}

      <section aria-labelledby="contacts-title" className="border-t border-line bg-paper-2 py-16 sm:py-20">
        <Container className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-fire uppercase">Контакты и соцсети</p>
            <h2 id="contacts-title" className="text-3xl font-semibold sm:text-4xl">
              Есть вопрос? Напиши нам
            </h2>
            <p className="mt-3 text-lg text-muted">{contacts.note}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
            {contacts.vkUrl && (
              <a href={contacts.vkUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "lg")}>
                <VkIcon className="size-5" /> ВКонтакте
              </a>
            )}
            {contacts.telegramUrl && (
              <a href={contacts.telegramUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "lg")}>
                <TelegramIcon className="size-5" /> Telegram
              </a>
            )}
            <Link href="/contacts" className={buttonClass("ghost", "lg")}>
              Все контакты
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
