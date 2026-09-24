import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@drago/database";
import { APPLICATION_SOURCE_LABELS, APPLICATION_STATUS_LABELS, formatDateTime, fullName } from "@drago/shared";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { ApplicationStatusForm, CreateAccountForm, DeleteApplication } from "../forms";

export const metadata: Metadata = { title: "Заявка" };

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin("applications.read");
  const { id } = await params;
  const app = await db.joinApplication.findUnique({
    where: { id },
    include: { handledBy: { select: { profile: true } }, user: { select: { id: true, email: true } } },
  });
  if (!app) notFound();
  const [lastName = "", ...rest] = app.fullName.split(/\s+/);
  const contactEmail = /@/.test(app.contact) ? app.contact : "";
  const tg = app.telegram ? `https://t.me/${app.telegram}` : null;
  const vk = app.vk ? (app.vk.startsWith("http") ? app.vk : `https://vk.com/${app.vk.replace(/^(vk\.(com|ru)\/)/, "")}`) : app.vkUserId ? `https://vk.com/id${app.vkUserId}` : null;

  return (
    <>
      <Link href="/admin/applications" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fire">
        <ArrowLeft className="size-4" aria-hidden /> Заявки
      </Link>
      <PageHeader title={app.fullName} description={<Badge tone="fire">{APPLICATION_STATUS_LABELS[app.status]}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Возраст</dt>
                <dd className="font-medium">{app.age}</dd>
              </div>
              <div>
                <dt className="text-muted">Контакт</dt>
                <dd className="font-medium break-all">{app.contact}</dd>
              </div>
              <div>
                <dt className="text-muted">Telegram</dt>
                <dd>{tg ? <a href={tg} target="_blank" rel="noopener noreferrer" className="font-medium text-fire">@{app.telegram}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">ВКонтакте</dt>
                <dd>{vk ? <a href={vk} target="_blank" rel="noopener noreferrer" className="font-medium break-all text-fire">{app.vk ?? `id${app.vkUserId}`}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Школа / колледж</dt>
                <dd className="font-medium">{app.school ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Источник</dt>
                <dd className="font-medium">{APPLICATION_SOURCE_LABELS[app.source]}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Комментарий</dt>
                <dd className="whitespace-pre-line">{app.comment ?? "—"}</dd>
              </div>
            </dl>
            <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
              Подана {formatDateTime(app.createdAt)} · согласие на обработку ПДн {formatDateTime(app.consentAt)}
              {app.handledBy?.profile ? ` · обрабатывает ${fullName(app.handledBy.profile)}` : ""}
            </p>
          </Card>
          {actor.can("applications.manage") && (
            <Card>
              <ApplicationStatusForm id={app.id} status={app.status} notes={app.notes} />
            </Card>
          )}
        </div>
        <aside className="space-y-4 self-start">
          <Card>
            <h2 className="mb-3 font-semibold">Аккаунт в кабинете</h2>
            {app.user ? (
              <Link href={`/admin/users/${app.user.id}`} className="text-sm font-semibold text-fire">
                {app.user.email} →
              </Link>
            ) : actor.can("users.manage") ? (
              <CreateAccountForm id={app.id} email={contactEmail} lastName={lastName} firstName={rest.join(" ")} />
            ) : (
              <p className="text-sm text-muted">Нет права создавать пользователей.</p>
            )}
          </Card>
          {actor.can("applications.manage") && (
            <Card>
              <DeleteApplication id={app.id} />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
