import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { SurveyEditor } from "../editor";

export const metadata: Metadata = { title: "Новая форма" };

export default async function NewSurvey() {
  await requireAdmin("surveys.manage");
  return (
    <>
      <PageHeader title="Новая форма" description="Сохраните как черновик, проверьте вопросы и включите «Форма активна»." />
      <div className="max-w-4xl">
        <SurveyEditor locked={false} />
      </div>
    </>
  );
}
