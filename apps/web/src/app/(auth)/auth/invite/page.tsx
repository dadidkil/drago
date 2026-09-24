import type { Metadata } from "next";
import { peekAuthToken } from "@/lib/auth/tokens";
import { NewPasswordForm } from "../../forms";

export const metadata: Metadata = { title: "Приглашение", robots: { index: false }, referrer: "no-referrer" };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const row = await peekAuthToken(token, "INVITE");
  if (!row || !token) {
    return (
      <>
        <h1 className="text-3xl font-bold">Приглашение недействительно</h1>
        <p className="mt-3 text-muted">Ссылка устарела или уже использована. Попросите командный состав отправить новое приглашение.</p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-3xl font-bold">Добро пожаловать{row.user.profile?.firstName ? `, ${row.user.profile.firstName}` : ""}!</h1>
      <p className="mt-2 mb-2 text-muted">Задайте пароль для входа в личный кабинет.</p>
      <p className="mb-8 text-sm text-muted">
        Аккаунт: <span className="font-medium text-ink">{row.user.email}</span>
      </p>
      <NewPasswordForm token={token} mode="invite" />
    </>
  );
}
