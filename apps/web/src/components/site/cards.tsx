import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock, MapPin } from "lucide-react";
import { EVENT_TYPE_LABELS, formatDate, formatDateShort, formatTime, formatWeekday, moscowParts } from "@drago/shared";
import { cn } from "@/components/ui/cn";
import { Markdown } from "@/components/ui/markdown";
import { mediaUrl } from "@/lib/uploads";
import { DragoMark, ELEMENTS } from "./brand";

const GRADIENTS = [
  "from-[#ff6a3d] via-[#c93510] to-[#3a1208]",
  "from-[#4fb3ff] via-[#1769aa] to-[#0b2640]",
  "from-[#8fd16a] via-[#3b7a2a] to-[#15300e]",
  "from-[#a9a4ff] via-[#5b54c9] to-[#1d1a47]",
];

export function ElementCover({ index, className, label }: { index: number; className?: string; label?: string }) {
  return (
    <div className={cn("absolute inset-0 flex items-end overflow-hidden bg-gradient-to-br", GRADIENTS[index % 4], className)}>
      <div aria-hidden className="bg-scales absolute inset-0" />
      <DragoMark className="absolute -right-6 -bottom-6 size-40 opacity-25" title="" />
      {label && <span className="relative m-4 text-xs font-semibold tracking-[0.16em] text-white/80 uppercase">{label}</span>}
    </div>
  );
}

export function ProjectCard({
  project,
  index,
}: {
  project: { slug: string; title: string; summary: string; partner: string | null; period: string | null; coverFileId: string | null };
  index: number;
}) {
  const cover = mediaUrl(project.coverFileId);
  const element = ELEMENTS[index % 4]!;
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white text-ink transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgb(21_19_26/0.35)]"
    >
      <div className="relative aspect-[16/10]">
        {cover ? (
          <Image src={cover} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
        ) : (
          <ElementCover index={index} label={element.label} />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-semibold">{project.title}</h3>
          <ArrowUpRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fire" aria-hidden />
        </div>
        <p className="mt-2 text-muted">{project.summary}</p>
        {(project.period || project.partner) && (
          <p className="mt-auto pt-4 text-sm font-medium text-ink-2">{[project.partner, project.period].filter(Boolean).join(" · ")}</p>
        )}
      </div>
    </Link>
  );
}

export function NewsCard({
  item,
  index = 0,
}: {
  item: { slug: string; title: string; excerpt: string | null; coverFileId: string | null; publishedAt: Date | null };
  index?: number;
}) {
  const cover = mediaUrl(item.coverFileId);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white text-ink">
      <div className="relative aspect-[16/9]">
        {cover ? (
          <Image src={cover} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <ElementCover index={index} />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {item.publishedAt && (
          <time dateTime={item.publishedAt.toISOString()} className="text-sm text-muted">
            {formatDate(item.publishedAt)}
          </time>
        )}
        <h3 className="mt-2 text-lg leading-snug font-semibold">
          <Link href={`/news/${item.slug}`} className="after:absolute after:inset-0 group-hover:text-fire">
            {item.title}
          </Link>
        </h3>
        {item.excerpt && <p className="mt-2 line-clamp-3 text-muted">{item.excerpt}</p>}
      </div>
    </article>
  );
}

export function TeamCard({
  member,
  index,
}: {
  member: { fullName: string; position: string; bio: string | null; photoFileId: string | null };
  index: number;
}) {
  const photo = mediaUrl(member.photoFileId);
  const initials = member.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white text-ink">
      <div className="relative aspect-[4/5]">
        {photo ? (
          <Image src={photo} alt={member.fullName} fill sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
        ) : (
          <div className={cn("absolute inset-0 flex items-center justify-center bg-gradient-to-br", GRADIENTS[index % 4])}>
            <div aria-hidden className="bg-scales absolute inset-0" />
            <span className="relative font-display text-6xl font-bold text-white/90" aria-hidden>
              {initials}
            </span>
          </div>
        )}
      </div>
      <div className="p-5">
        <p className="text-xs font-semibold tracking-[0.14em] text-fire uppercase">{member.position}</p>
        <h3 className="mt-1.5 text-xl font-semibold">{member.fullName}</h3>
        {member.bio && <Markdown source={member.bio} className="mt-2 text-[0.95rem] text-muted" />}
      </div>
    </article>
  );
}

export function EventList({
  events,
}: {
  events: { id: string; title: string; description: string | null; type: keyof typeof EVENT_TYPE_LABELS; startsAt: Date; endsAt: Date | null; allDay: boolean; location: string | null }[];
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
      {events.map((e) => {
        const p = moscowParts(e.startsAt);
        return (
          <li key={e.id} className="flex gap-4 p-5 sm:gap-6 sm:p-6">
            <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-ink py-3 text-paper sm:w-20">
              <span className="font-display text-2xl leading-none font-bold sm:text-3xl">{p.day}</span>
              <span className="mt-1 text-xs tracking-wide uppercase">{formatDateShort(e.startsAt).replace(/^\d+\s/, "")}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.14em] text-fire uppercase">{EVENT_TYPE_LABELS[e.type]}</p>
              <h3 className="mt-1 text-lg font-semibold">{e.title}</h3>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden />
                  {formatWeekday(e.startsAt)}, {formatDate(e.startsAt)}
                </span>
                {!e.allDay && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" aria-hidden />
                    {formatTime(e.startsAt)}
                    {e.endsAt ? `–${formatTime(e.endsAt)}` : ""}
                  </span>
                )}
                {e.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden />
                    {e.location}
                  </span>
                )}
              </div>
              {e.description && <p className="mt-2 line-clamp-2 text-[0.95rem] text-ink-2">{e.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function FaqList({ items }: { items: { id: string; question: string; answer: string }[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
      {items.map((item) => (
        <details key={item.id} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-lg font-semibold sm:px-6 [&::-webkit-details-marker]:hidden">
            {item.question}
            <span
              aria-hidden
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-paper-2 text-xl transition-transform duration-300 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <Markdown source={item.answer} className="px-5 pb-6 text-ink-2 sm:px-6" />
        </details>
      ))}
    </div>
  );
}

export function PhotoGrid({ photos }: { photos: { id: string; fileId: string; caption: string | null }[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo, i) => (
        <li key={photo.id} className={cn("relative overflow-hidden rounded-2xl bg-paper-2", i % 5 === 0 ? "row-span-2 aspect-[3/4] md:aspect-auto" : "aspect-square")}>
          <a href={`/media/${photo.fileId}`} target="_blank" rel="noopener" className="group block size-full">
            <Image
              src={`/media/${photo.fileId}`}
              alt={photo.caption ?? "Фото отряда"}
              fill
              sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {photo.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-3 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
                {photo.caption}
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
