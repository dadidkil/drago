import type { Metadata } from "next";
import Link from "next/link";
import { peekAuthToken } from "@/lib/auth/tokens";
import { NewPasswordForm } from "../../forms";

export const metadata: Metadata = { title: "Новый пароль", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const row = await peekAuthToken(token, "PASSWORD_RESET");
  if (!row || !token) {
    return (
      <>
        <h1 className="text-3xl font-bold">Ссылка устарела</h1>
        <p className="mt-3 text-muted">Ссылка для сброса пароля недействительна или уже использована.</p>
        <Link href="/auth/forgot" className="mt-6 inline-block font-semibold text-fire">
          Запросить новую ссылку
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-3xl font-bold">Новый пароль</h1>
      <p className="mt-2 mb-8 text-muted">После смены пароля все активные сессии будут завершены.</p>
      <NewPasswordForm token={token} mode="reset" />
    </>
  );
}
