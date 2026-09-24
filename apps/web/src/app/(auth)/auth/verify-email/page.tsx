import type { Metadata } from "next";
import { ConfirmEmailForm } from "../../forms";

export const metadata: Metadata = { title: "Подтверждение email", robots: { index: false }, referrer: "no-referrer" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-bold">Подтверждение email</h1>
      <p className="mt-2 mb-8 text-muted">Нажмите кнопку, чтобы подтвердить адрес электронной почты.</p>
      {token ? <ConfirmEmailForm token={token} /> : <p className="text-danger">Ссылка неполная.</p>}
    </>
  );
}
