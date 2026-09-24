"use client";

import { ActionForm, FormMessage, SubmitButton } from "@/components/ui/form";
import { respondToEvent } from "../actions";

export function RsvpForm({ eventId, current }: { eventId: string; current: string | null }) {
  return (
    <ActionForm action={respondToEvent} refreshOnSuccess className="flex flex-wrap gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <SubmitButton name="status" value="GOING" variant={current === "GOING" ? "primary" : "secondary"} size="sm" pendingText="…">
        Иду
      </SubmitButton>
      <SubmitButton name="status" value="MAYBE" variant={current === "MAYBE" ? "primary" : "ghost"} size="sm" pendingText="…">
        Возможно
      </SubmitButton>
      <SubmitButton name="status" value="NOT_GOING" variant={current === "NOT_GOING" ? "primary" : "ghost"} size="sm" pendingText="…">
        Не смогу
      </SubmitButton>
      <FormMessage className="w-full" />
    </ActionForm>
  );
}
