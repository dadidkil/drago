import type { Metadata } from "next";
import { db } from "@drago/database";
import { EXTERNAL_CHANNELS, CHANNEL_LABELS, NOTIFICATION_META, NOTIFICATION_TYPES, fullName } from "@drago/shared";
import { InlineAction } from "@/components/ui/form";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { fileUrl } from "@/lib/uploads";
import { resendEmailVerification } from "./actions";
import { NotificationPrefsForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Профиль" };

export default async function ProfilePage() {
  const user = await requireUser();
  const [prefs, links, mailbox] = await Promise.all([
    db.notificationPreference.findMany({ where: { userId: user.id } }),
    db.user.findUnique({ where: { id: user.id }, select: { telegramAccount: { select: { id: true } }, vkAccount: { select: { id: true } } } }),
    db.emailAccount.findUnique({ where: { userId: user.id }, select: { address: true, status: true } }),
  ]);
  const p = user.profile;
  const name = p ? fullName(p) : user.email;

  const rows = NOTIFICATION_TYPES.filter((t) => NOTIFICATION_META[t].configurable && (t !== "APPLICATION_NEW" || user.can("applications.read"))).map((t) => ({
    type: t,
    label: NOTIFICATION_META[t].label,
    values: Object.fromEntries(
      EXTERNAL_CHANNELS.map((ch) => [ch, prefs.find((x) => x.type === t && x.channel === ch)?.enabled ?? NOTIFICATION_META[t].defaults[ch]]),
    ),
  }));
  const channels = EXTERNAL_CHANNELS.map((ch) => ({
    key: ch,
    label: CHANNEL_LABELS[ch],
    available: ch === "TELEGRAM" ? Boolean(links?.telegramAccount) : ch === "VK" ? Boolean(links?.vkAccount) : user.emailVerified,
  }));

  return (
    <>
      <PageHeader title="Профиль" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-5 text-lg font-semibold">Личные данные</h2>
            <ProfileForm
              profile={{
                lastName: p?.lastName ?? "",
                firstName: p?.firstName ?? "",
                middleName: p?.middleName ?? null,
                phone: p?.phone ?? null,
                bio: p?.bio ?? null,
                hasAvatar: Boolean(p?.avatarFileId),
              }}
            />
          </Card>
          <Card>
            <h2 id="notifications" className="mb-5 text-lg font-semibold">
              Уведомления
            </h2>
            <NotificationPrefsForm rows={rows} channels={channels} />
          </Card>
        </div>
        <aside className="space-y-4 self-start">
          <Card className="text-center">
            <Avatar src={p?.avatarFileId ? fileUrl(p.avatarFileId) : null} name={name} size={96} className="mx-auto" />
            <p className="mt-3 text-lg font-semibold">{name}</p>
            <p className="text-sm text-muted">{p?.position || user.role.name}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <Badge tone="dark">{user.role.name}</Badge>
              {p?.squadStatus && <Badge>{p.squadStatus}</Badge>}
              {p?.joinedYear && <Badge tone="air">в отряде с {p.joinedYear}</Badge>}
            </div>
          </Card>
          <Card>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted">Email для входа</dt>
                <dd className="font-medium break-all">{user.email}</dd>
                <dd className="mt-1">
                  {user.emailVerified ? (
                    <Badge tone="success">подтверждён</Badge>
                  ) : (
                    <InlineAction action={resendEmailVerification} fields={{}} label="Подтвердить email" variant="secondary" refresh={false} />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Корпоративная почта</dt>
                <dd className="font-medium">{mailbox?.status === "ACTIVE" ? mailbox.address : "не создана"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted">Email для входа, роль и должность меняет командный состав.</p>
          </Card>
        </aside>
      </div>
    </>
  );
}
