import Link from "next/link";
import { CalendarDays, Clock, FileText, MapPin, Paperclip, Pin } from "lucide-react";
import {
  EVENT_TYPE_LABELS,
  PARTICIPATION_LABELS,
  TASK_STATUS_LABELS,
  formatBytes,
  formatDate,
  formatDateTime,
  formatTime,
  formatWeekday,
} from "@drago/shared";
import { Badge } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/markdown";
import { fileUrl } from "@/lib/uploads";

export function TaskStatusBadge({ status }: { status: keyof typeof TASK_STATUS_LABELS }) {
  const tone = status === "DONE" ? "success" : status === "IN_PROGRESS" ? "water" : status === "CANCELLED" ? "neutral" : "fire";
  return <Badge tone={tone}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function DueLabel({ dueAt, done }: { dueAt: Date | null; done?: boolean }) {
  if (!dueAt) return <span className="text-muted">без срока</span>;
  const overdue = !done && dueAt.getTime() < Date.now();
  const soon = !done && !overdue && dueAt.getTime() - Date.now() < 48 * 3600_000;
  return (
    <span className={overdue ? "font-semibold text-danger" : soon ? "font-semibold text-warning" : "text-muted"}>
      {overdue ? "просрочено · " : "до "}
      {formatDateTime(dueAt)}
    </span>
  );
}

export function AttachmentList({ files }: { files: { id: string; originalName: string; size: number }[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f.id}>
          <a
            href={fileUrl(f.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm hover:border-fire hover:text-fire"
          >
            <Paperclip className="size-3.5" aria-hidden />
            <span className="max-w-[16rem] truncate">{f.originalName}</span>
            <span className="text-xs text-muted">{formatBytes(f.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function AnnouncementCard({
  a,
}: {
  a: {
    id: string;
    title: string;
    body: string;
    pinned: boolean;
    createdAt: Date;
    expiresAt: Date | null;
    attachments: { id: string; originalName: string; size: number }[];
  };
}) {
  return (
    <article className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {a.pinned && (
          <Badge tone="fire">
            <Pin className="size-3" aria-hidden /> Закреплено
          </Badge>
        )}
        <time dateTime={a.createdAt.toISOString()}>{formatDate(a.createdAt)}</time>
        {a.expiresAt && <span>· актуально до {formatDate(a.expiresAt)}</span>}
      </div>
      <h3 className="mt-2 text-lg font-semibold">{a.title}</h3>
      <Markdown source={a.body} className="mt-2 text-[0.97rem]" />
      <AttachmentList files={a.attachments} />
    </article>
  );
}

export function EventRow({
  e,
  myStatus,
  href,
}: {
  e: { id: string; title: string; type: keyof typeof EVENT_TYPE_LABELS; startsAt: Date; endsAt: Date | null; allDay: boolean; location: string | null; status: "SCHEDULED" | "CANCELLED" };
  myStatus?: keyof typeof PARTICIPATION_LABELS | null;
  href: string;
}) {
  return (
    <Link href={href} className="flex gap-4 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-fire/50 sm:p-5">
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-ink py-2 text-paper">
        <span className="font-display text-xl leading-none font-bold">{e.startsAt.toLocaleDateString("ru-RU", { day: "numeric", timeZone: "Europe/Moscow" })}</span>
        <span className="mt-1 text-[0.65rem] tracking-wide uppercase">{formatWeekday(e.startsAt)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-[0.12em] text-fire uppercase">{EVENT_TYPE_LABELS[e.type]}</span>
          {e.status === "CANCELLED" && <Badge tone="danger">Отменено</Badge>}
          {myStatus && myStatus !== "INVITED" && <Badge tone={myStatus === "GOING" ? "success" : "neutral"}>{PARTICIPATION_LABELS[myStatus]}</Badge>}
        </div>
        <p className="mt-1 font-semibold">{e.title}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden /> {formatDate(e.startsAt)}
          </span>
          {!e.allDay && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> {formatTime(e.startsAt)}
              {e.endsAt ? `–${formatTime(e.endsAt)}` : ""}
            </span>
          )}
          {e.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden /> {e.location}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function DocumentRow({ d }: { d: { id: string; title: string; description: string | null; fileId: string; createdAt: Date; category: { name: string }; file: { size: number; mimeType: string } } }) {
  return (
    <li className="flex items-start gap-4 p-4 sm:p-5">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-paper-2 text-ink-2">
        <FileText className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <a href={fileUrl(d.fileId)} className="font-semibold hover:text-fire">
          {d.title}
        </a>
        {d.description && <p className="mt-0.5 text-sm text-muted">{d.description}</p>}
        <p className="mt-1 text-xs text-muted">
          {d.category.name} · {formatBytes(d.file.size)} · {formatDate(d.createdAt)}
        </p>
      </div>
    </li>
  );
}
