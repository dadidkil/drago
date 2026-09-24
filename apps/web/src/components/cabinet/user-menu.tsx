"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Avatar } from "@/components/ui/misc";
import { ActionForm, SubmitButton } from "@/components/ui/form";

export function UserMenu({ name, roleName, avatarUrl }: { name: string; roleName: string; avatarUrl: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <Link href="/cabinet/profile" className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-paper-2">
        <Avatar src={avatarUrl} name={name} size={34} />
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-sm font-semibold">{name}</span>
          <span className="text-xs text-muted">{roleName}</span>
        </span>
      </Link>
      <ActionForm action={logout}>
        <SubmitButton variant="ghost" size="sm" pendingText="…" aria-label="Выйти" title="Выйти">
          <LogOut className="size-4" />
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
