"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { submitSurvey, SurveyError } from "@drago/core";
import { fullName } from "@drago/shared";
import { userAction, UserError, zf } from "@/lib/actions";

/** Ответы на форму. Остальные поля FormData — ответы по id вопросов; проверяются в submitSurvey. */
export const submitSurveyAction = userAction({ schema: z.looseObject({ surveyId: zf.id() }) }, async (d, { user }) => {
  const { surveyId, ...raw } = d;
  try {
    await submitSurvey(surveyId, { id: user.id, roleLevel: user.level, name: user.profile ? fullName(user.profile) : user.email }, raw);
  } catch (err) {
    if (err instanceof SurveyError) throw new UserError(err.message, err.fieldErrors);
    throw err;
  }
  // Баннер и блокировка кабинета считаются в layout — обновляем его.
  revalidatePath("/cabinet", "layout");
  redirect(`/cabinet/surveys?done=${surveyId}`);
});
