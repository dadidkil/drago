import type { Metadata } from "next";
import { db } from "@drago/database";
import { InlineAction } from "@/components/ui/form";
import { ImageCropUpload } from "@/components/ui/image-crop-upload";
import { Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { deleteTeamMember, removeTeamPhoto, setTeamPhoto } from "../actions";
import { TeamMemberForm } from "../forms";

export const metadata: Metadata = { title: "Командный состав" };

export default async function TeamAdmin() {
  await requireAdmin("pages.manage");
  const members = await db.teamMember.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <>
      <PageHeader title="Командный состав на сайте" description="Публичные карточки. Не связаны с внутренними аккаунтами и не раскрывают контакты." />
      <div className="space-y-4">
        {members.map((m) => (
          <Card key={m.id} className="grid gap-5 md:grid-cols-[13rem_1fr]">
            <ImageCropUpload
              action={setTeamPhoto}
              fields={{ id: m.id }}
              aspect={4 / 5}
              output={{ width: 800, height: 1000 }}
              round={false}
              removeAction={m.photoFileId ? removeTeamPhoto : undefined}
              preview={
                m.photoFileId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/${m.photoFileId}`} alt="" className="aspect-[4/5] w-36 rounded-xl object-cover" />
                ) : (
                  <div className="flex aspect-[4/5] w-36 items-center justify-center rounded-xl bg-paper-2 text-xs text-muted">Нет фото</div>
                )
              }
              hint="Публичное фото — только с согласия человека (и родителей, если ему нет 18)"
            />
            <div>
              <TeamMemberForm m={m} />
              <div className="mt-3 border-t border-line pt-3">
                <InlineAction action={deleteTeamMember} fields={{ id: m.id }} label="Удалить карточку" confirm="Удалить карточку?" />
              </div>
            </div>
          </Card>
        ))}
        <Card className="border-dashed">
          <h2 className="mb-3 font-semibold">Добавить</h2>
          <TeamMemberForm />
        </Card>
      </div>
    </>
  );
}
