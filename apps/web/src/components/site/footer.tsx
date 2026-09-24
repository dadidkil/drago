import Link from "next/link";
import type { SettingValue } from "@drago/shared";
import { TelegramIcon, VkIcon, Wordmark } from "./brand";

export function SiteFooter({
  general,
  contacts,
}: {
  general: SettingValue<"site.general">;
  contacts: SettingValue<"site.contacts">;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-scales relative overflow-hidden bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <Wordmark dark />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-dark">{general.tagline}</p>
          <div className="mt-6 flex gap-3">
            {contacts.vkUrl && (
              <a
                href={contacts.vkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-11 items-center justify-center rounded-xl bg-white/8 text-paper transition-colors hover:bg-[#0077ff]"
                aria-label="ТОП «Драго» ВКонтакте"
              >
                <VkIcon className="size-6" />
              </a>
            )}
            {contacts.telegramUrl && (
              <a
                href={contacts.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-11 items-center justify-center rounded-xl bg-white/8 text-paper transition-colors hover:bg-[#229ed9]"
                aria-label="ТОП «Драго» в Telegram"
              >
                <TelegramIcon className="size-5" />
              </a>
            )}
          </div>
        </div>
        <nav aria-label="Разделы сайта">
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-dark uppercase">Отряд</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              ["/about", "О нас"],
              ["/team", "Командный состав"],
              ["/projects", "Проекты"],
              ["/news", "Новости"],
              ["/gallery", "Галерея"],
              ["/events", "Календарь событий"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href!} className="text-paper/85 transition-colors hover:text-fire-bright">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-dark uppercase">Участникам</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link href="/join" className="text-paper/85 hover:text-fire-bright">
                Вступить в отряд
              </Link>
            </li>
            <li>
              <Link href="/cabinet" className="text-paper/85 hover:text-fire-bright">
                Личный кабинет
              </Link>
            </li>
            <li>
              <Link href="/contacts" className="text-paper/85 hover:text-fire-bright">
                Контакты
              </Link>
            </li>
            {contacts.email && (
              <li>
                <a href={`mailto:${contacts.email}`} className="text-paper/85 hover:text-fire-bright">
                  {contacts.email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-dark sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {year} ТОП «Драго». Трудовые отряды подростков Москвы · РСО</p>
          <Link href="/privacy" className="hover:text-paper">
            Политика обработки персональных данных
          </Link>
        </div>
      </div>
    </footer>
  );
}
