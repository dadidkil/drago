import type { Metadata } from "next";
import { Users } from "lucide-react";
import { db } from "@drago/database";
import { STAFF_LEVEL, FIGHTER_LEVEL, fullName } from "@drago/shared";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { fileUrl } from "@/lib/uploads";

export const metadata: Metadata = { title: "Отряд" };

/**
 * Внутренний список отряда. Минимизация данных:
 *  - кандидаты видят только командный состав;
 *  - контакты (email, телефон, Telegram) — только у кого есть право users.read.
 */
export default async function TeamPage() {
  const user = await requireUser();
  const canSeeContacts = user.can("users.read");
  const minLevel = user.level >= FIGHTER_LEVEL ? 0 : STAFF_LEVEL;
  const members = await db.user.findMany({
    where: { status: "ACTIVE", role: { level: { gte: minLevel } } },
    orderBy: [{ role: { level: "desc" } }, { profile: { lastName: "asc" } }],
    select: {
      id: true,
      email: true,
      role: { select: { name: true, level: true } },
      profile: { select: { firstName: true, lastName: true, position: true, squadStatus: true, avatarFileId: true, phone: true, joinedYear: true } },
      telegramAccount: canSeeContacts ? { select: { username: true } } : false,
      emailAccount: { select: { address: true, status: true } },
    },
  });
  const staff = members.filter((m) => m.role.level >= STAFF_LEVEL);
  const fighters = members.filter((m) => m.role.level < STAFF_LEVEL);

  const renderList = (list: typeof members) => (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((m) => {
        const name = m.profile ? fullName(m.profile) : "Без имени";
        return (
          <li key={m.id} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
            <Avatar src={m.profile?.avatarFileId ? fileUrl(m.profile.avatarFileId) : null} name={name} size={48} />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{name}</p>
              <p className="text-muted">{m.profile?.position || m.role.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {m.profile?.squadStatus && <Badge>{m.profile.squadStatus}</Badge>}
                {m.profile?.joinedYear && <Badge tone="air">с {m.profile.joinedYear}</Badge>}
              </div>
              {m.emailAccount?.status === "ACTIVE" && (
                <a href={`mailto:${m.emailAccount.address}`} className="mt-1 block truncate text-fire hover:underline">
                  {m.emailAccount.address}
                </a>
              )}
              {canSeeContacts && (
                <div className="mt-1 space-y-0.5 text-xs text-muted">
                  <p className="truncate">{m.email}</p>
                  {m.profile?.phone && <p>{m.profile.phone}</p>}
                  {m.telegramAccount?.username && <p>@{m.telegramAccount.username}</p>}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <PageHeader
        title="Отряд"
        description={canSeeContacts ? "Контакты бойцов видны только командному составу. Не передавайте их третьим лицам." : "Бойцы и командный состав «Драго»."}
      />
      {members.length === 0 ? (
        <EmptyState title="Пока никого нет" icon={<Users className="size-8" />} />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Командный состав</h2>
            {renderList(staff)}
          </section>
          {fighters.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Бойцы и кандидаты</h2>
              {renderList(fighters)}
            </section>
          )}
        </div>
      )}
    </>
  );
}
