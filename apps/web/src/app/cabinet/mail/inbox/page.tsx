import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Paperclip } from "lucide-react";
import { db } from "@drago/database";
import { listInbox, readMessage } from "@drago/core";
import { formatDateTime } from "@drago/shared";
import { buttonClass } from "@/components/ui/button";
import { InlineAction } from "@/components/ui/form";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { deleteMessage } from "./actions";
import { mailboxCreds } from "./creds";
import { ComposeBox } from "./forms";

export const metadata: Metadata = { title: "Почта" };
// Почта всегда живая: кэшировать чужие письма между запросами нельзя.
export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ uid?: string; to?: string }> }) {
  const user = await requireUser("/cabinet/mail/inbox");
  const { uid, to } = await searchParams;
  const account = await db.emailAccount.findUnique({ where: { userId: user.id } });

  if (!account || account.status !== "ACTIVE") {
    return (
      <>
        <PageHeader title="Входящие" description="Почта отряда прямо в кабинете." />
        <EmptyState title="Ящик ещё не готов" icon={<Mail className="size-8" />}>
          Корпоративный ящик создаёт командный состав. Как только он появится, письма будут здесь.
        </EmptyState>
      </>
    );
  }

  // Вход автоматический: пароль ящика знает только система.
  const access = await mailboxCreds(user.id, { verify: !account.passwordEnc });
  if (!access.ok) {
    return (
      <>
        <PageHeader title="Почта" description={account.address} />
        <EmptyState title="Почта сейчас недоступна" icon={<Mail className="size-8" />}>
          {access.message}. Попробуйте позже или напишите командиру.
        </EmptyState>
      </>
    );
  }
  const creds = access.creds;

  let messages: Awaited<ReturnType<typeof listInbox>> = [];
  let failure: string | null = null;
  try {
    messages = await listInbox(creds);
  } catch (err) {
    failure = (err as Error).message.slice(0, 200);
  }
  const opened = uid && !failure ? await readMessage(creds, Number(uid)).catch(() => null) : null;
  // Письмо открыли — оно прочитано: счётчик в меню и воркер узнают об этом.
  const unseen = messages.filter((m) => !m.seen && String(m.uid) !== uid).length;
  if (!failure && unseen !== account.unreadCount) {
    await db.emailAccount.update({ where: { id: account.id }, data: { unreadCount: unseen } }).catch(() => undefined);
  }

  return (
    <>
      <PageHeader
        title="Почта"
        description={account.address}
        actions={
          <Link href="/cabinet/mail/inbox?to=" className={buttonClass("primary", "sm")}>
            Написать
          </Link>
        }
      />

      {failure && (
        <Card className="mb-6 border-danger/40">
          <p className="font-semibold">Почтовый сервер не ответил</p>
          <p className="mt-1 text-sm text-muted">{failure}</p>
        </Card>
      )}

      {to !== undefined && (
        <Card className="mb-6">
          <h2 className="mb-4 font-semibold">Новое письмо</h2>
          <ComposeBox defaultTo={to} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto p-0">
          {messages.length === 0 && !failure ? (
            <p className="p-6 text-sm text-muted">Писем пока нет.</p>
          ) : (
            <ul className="divide-y divide-line">
              {messages.map((m) => (
                <li key={m.uid}>
                  <Link
                    href={`/cabinet/mail/inbox?uid=${m.uid}`}
                    className={`block px-5 py-4 transition-colors hover:bg-line/40 ${String(m.uid) === uid ? "bg-line/60" : ""}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`truncate ${m.seen ? "text-muted" : "font-semibold"}`}>{m.from}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted">{formatDateTime(new Date(m.date))}</span>
                    </div>
                    <p className={`mt-1 truncate text-sm ${m.seen ? "text-muted" : ""}`}>{m.subject}</p>
                    {m.hasAttachments && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted">
                        <Paperclip className="size-3" /> вложение
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          {!opened ? (
            <p className="text-sm text-muted">Выберите письмо слева.</p>
          ) : (
            <article>
              <header className="border-b border-line pb-4">
                <h2 className="font-display text-xl font-semibold">{opened.subject}</h2>
                <p className="mt-2 text-sm">
                  {opened.from} <span className="text-muted">&lt;{opened.fromAddress}&gt;</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  кому: {opened.to} · {formatDateTime(new Date(opened.date))}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link href={`/cabinet/mail/inbox?uid=${opened.uid}&to=${encodeURIComponent(opened.fromAddress)}`} className={buttonClass("secondary", "sm")}>
                    Ответить
                  </Link>
                  <InlineAction action={deleteMessage} fields={{ uid: String(opened.uid) }} label="В корзину" confirm="Убрать письмо в корзину?" />
                  {opened.attachments.map((a, i) => (
                    <a
                      key={`${a.filename}-${i}`}
                      href={`/cabinet/mail/inbox/attachment?uid=${opened.uid}&i=${i}`}
                      className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-2.5 py-0.5 text-xs font-semibold hover:text-fire"
                    >
                      <Paperclip className="size-3" aria-hidden /> {a.filename} · {Math.round(a.size / 1024)} КБ
                    </a>
                  ))}
                </div>
              </header>
              {opened.html ? (
                // Письмо из интернета — недоверенный HTML. Песочница без скриптов и без внешних
                // запросов: ни трекинг-пиксели, ни формы внутри письма не сработают.
                <iframe
                  title="Текст письма"
                  sandbox=""
                  className="mt-5 h-[50vh] w-full rounded-lg border border-line bg-white"
                  srcDoc={`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><base target="_blank"><style>body{font:15px/1.55 system-ui,sans-serif;margin:16px;color:#14110f}</style>${opened.html}`}
                />
              ) : (
                <pre className="mt-5 whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed">{opened.text || "(пустое письмо)"}</pre>
              )}
            </article>
          )}
        </Card>
      </div>
    </>
  );
}
