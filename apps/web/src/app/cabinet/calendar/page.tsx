import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@drago/database";
import { EVENT_TYPE_LABELS, formatTime, moscowParts } from "@drago/shared";
import { PageHeader } from "@/components/ui/misc";
import { cn } from "@/components/ui/cn";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Календарь" };

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const TYPE_COLORS: Record<string, string> = {
  EVENT: "bg-fire-soft text-[#8f2508]",
  MEETING: "bg-[#e3f0fb] text-water",
  TRIP: "bg-[#ecebff] text-air",
  WORK: "bg-[#e8f3e2] text-earth",
  DEADLINE: "bg-[#fdecea] text-danger",
  OTHER: "bg-paper-2 text-ink-2",
};

function mskDate(y: number, m: number, d: number) {
  return new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00+03:00`);
}

interface Item {
  id: string;
  title: string;
  href: string;
  time: string | null;
  kind: string;
  label: string;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUser();
  const { m } = await searchParams;
  const now = moscowParts(new Date());
  const match = /^(\d{4})-(\d{2})$/.exec(m ?? "");
  const year = match ? Number(match[1]) : now.year;
  const month = match ? Math.min(12, Math.max(1, Number(match[2]))) : now.month;

  const start = mskDate(year, month, 1);
  const end = month === 12 ? mskDate(year + 1, 1, 1) : mskDate(year, month + 1, 1);
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86400_000);
  const firstWeekday = (new Date(start.getTime() + 3 * 3600_000).getUTCDay() + 6) % 7;

  const [events, tasks] = await Promise.all([
    db.event.findMany({
      where: { minRoleLevel: { lte: user.level }, startsAt: { lt: end }, OR: [{ startsAt: { gte: start } }, { endsAt: { gte: start } }] },
      orderBy: { startsAt: "asc" },
    }),
    db.task.findMany({
      where: { assignees: { some: { userId: user.id } }, dueAt: { gte: start, lt: end }, status: { in: ["NEW", "IN_PROGRESS"] } },
      orderBy: { dueAt: "asc" },
    }),
  ]);

  const byDay = new Map<number, Item[]>();
  const push = (day: number, item: Item) => byDay.set(day, [...(byDay.get(day) ?? []), item]);
  for (const e of events) {
    const s = e.startsAt < start ? start : e.startsAt;
    const last = e.endsAt && e.endsAt < end ? e.endsAt : e.endsAt ? new Date(end.getTime() - 1) : s;
    const d1 = moscowParts(s).day;
    const d2 = moscowParts(last).month === month ? moscowParts(last).day : d1;
    for (let d = d1; d <= Math.max(d1, d2); d++) {
      push(d, {
        id: `${e.id}-${d}`,
        title: e.title,
        href: `/cabinet/events/${e.id}`,
        time: d === d1 && !e.allDay ? formatTime(e.startsAt) : null,
        kind: e.status === "CANCELLED" ? "OTHER" : e.type,
        label: EVENT_TYPE_LABELS[e.type],
      });
    }
  }
  for (const t of tasks) {
    push(moscowParts(t.dueAt!).day, { id: t.id, title: t.title, href: `/cabinet/tasks/${t.id}`, time: formatTime(t.dueAt!), kind: "DEADLINE", label: "Дедлайн" });
  }

  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const isCurrentMonth = year === now.year && month === now.month;
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, i) => i - firstWeekday + 1);

  return (
    <>
      <PageHeader
        title={`${MONTHS[month - 1]} ${year}`}
        eyebrow="Календарь"
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/cabinet/calendar?m=${prev}`} className="inline-flex size-10 items-center justify-center rounded-xl bg-white hover:bg-paper-2" aria-label="Предыдущий месяц">
              <ChevronLeft className="size-5" />
            </Link>
            {!isCurrentMonth && (
              <Link href="/cabinet/calendar" className="rounded-xl bg-white px-3 py-2 text-sm font-semibold hover:bg-paper-2">
                Сегодня
              </Link>
            )}
            <Link href={`/cabinet/calendar?m=${next}`} className="inline-flex size-10 items-center justify-center rounded-xl bg-white hover:bg-paper-2" aria-label="Следующий месяц">
              <ChevronRight className="size-5" />
            </Link>
          </div>
        }
      />

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-white md:block">
        <div className="grid grid-cols-7 border-b border-line bg-paper text-center text-xs font-semibold text-muted uppercase">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const inMonth = day >= 1 && day <= daysInMonth;
            const today = inMonth && isCurrentMonth && day === now.day;
            const items = inMonth ? (byDay.get(day) ?? []) : [];
            return (
              <div key={i} className={cn("min-h-28 border-r border-b border-line p-1.5", !inMonth && "bg-paper/60", i % 7 === 6 && "border-r-0")}>
                {inMonth && (
                  <>
                    <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-sm", today ? "bg-fire font-bold text-white" : "text-ink-2")}>
                      {day}
                    </span>
                    <ul className="mt-1 space-y-1">
                      {items.slice(0, 3).map((it) => (
                        <li key={it.id}>
                          <Link href={it.href} title={`${it.label}: ${it.title}`} className={cn("block truncate rounded-md px-1.5 py-0.5 text-xs font-medium", TYPE_COLORS[it.kind])}>
                            {it.time && <span className="opacity-70">{it.time} </span>}
                            {it.title}
                          </Link>
                        </li>
                      ))}
                      {items.length > 3 && <li className="px-1.5 text-xs text-muted">ещё {items.length - 3}</li>}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Мобильная «повестка» */}
      <ol className="space-y-3 md:hidden">
        {[...byDay.entries()]
          .sort(([a], [b]) => a - b)
          .map(([day, items]) => (
            <li key={day} className="rounded-2xl border border-line bg-white p-4">
              <p className="font-display font-semibold">
                {day} {MONTHS[month - 1]!.toLowerCase()}
              </p>
              <ul className="mt-2 space-y-1.5">
                {items.map((it) => (
                  <li key={it.id}>
                    <Link href={it.href} className={cn("block rounded-lg px-2.5 py-1.5 text-sm font-medium", TYPE_COLORS[it.kind])}>
                      {it.time && <span className="opacity-70">{it.time} · </span>}
                      {it.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        {byDay.size === 0 && <li className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">В этом месяце событий нет</li>}
      </ol>

      <ul className="mt-5 flex flex-wrap gap-2 text-xs">
        {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
          <li key={k} className={cn("rounded-md px-2 py-1 font-medium", TYPE_COLORS[k])}>
            {v}
          </li>
        ))}
      </ul>
    </>
  );
}
