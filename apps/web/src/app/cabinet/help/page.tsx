import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@drago/database";
import { STAFF_LEVEL, fullName } from "@drago/shared";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Помощь" };

const FAQ = [
  ["Как подключить уведомления в Telegram?", "Откройте «Безопасность» → «Мессенджеры» → «Подключить Telegram», перейдите по ссылке и нажмите «Start» в боте. Ссылка одноразовая и действует 10 минут."],
  ["Как ответить, пойду ли я на мероприятие?", "Откройте мероприятие в разделе «Мероприятия» и нажмите «Иду», «Возможно» или «Не смогу». Это можно сделать и в Telegram-боте."],
  ["Где взять пароль от корпоративной почты?", "Когда командный состав создаст ящик, в разделе «Почта» появится кнопка «Показать временный пароль». Он показывается один раз — сохраните его и смените после входа в веб-почту."],
  ["Забыл пароль от кабинета", "На странице входа нажмите «Забыли пароль?» — придёт письмо со ссылкой. Если email недоступен, обратитесь к командиру."],
  ["Потерял телефон с 2FA", "Используйте один из резервных кодов вместо кода из приложения. Если кодов нет — обратитесь к администратору, он сбросит 2FA после проверки."],
  ["Кто видит мои данные?", "Имя, роль и фото видят участники отряда. Email и телефон — только командный состав. Публичных списков бойцов нет."],
] as const;

export default async function HelpPage() {
  const user = await requireUser();
  const staff = await db.user.findMany({
    where: { status: "ACTIVE", role: { level: { gte: STAFF_LEVEL, lt: 100 } } },
    orderBy: { role: { level: "desc" } },
    take: 6,
    select: { id: true, role: { select: { name: true } }, profile: { select: { firstName: true, lastName: true, position: true } }, emailAccount: { select: { address: true, status: true } } },
  });
  return (
    <>
      <PageHeader title="Помощь" description="Ответы на частые вопросы по кабинету." />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group p-5">
              <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">{q}</summary>
              <p className="mt-2 text-ink-2">{a}</p>
            </details>
          ))}
        </div>
        <aside className="space-y-4 self-start">
          <Card>
            <h2 className="font-semibold">Командный состав</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {staff.map((s) => (
                <li key={s.id}>
                  <p className="font-medium">{s.profile ? fullName(s.profile) : "—"}</p>
                  <p className="text-muted">{s.profile?.position || s.role.name}</p>
                  {s.emailAccount?.status === "ACTIVE" && (
                    <a href={`mailto:${s.emailAccount.address}`} className="text-fire hover:underline">
                      {s.emailAccount.address}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <p className="text-sm text-muted">
              Ваша роль: <span className="font-semibold text-ink">{user.role.name}</span>
            </p>
            <Link href="/cabinet/security" className="mt-2 inline-block text-sm font-semibold text-fire">
              Настройки безопасности →
            </Link>
          </Card>
        </aside>
      </div>
    </>
  );
}
