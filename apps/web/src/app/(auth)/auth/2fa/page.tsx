import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { TwoFactorForm } from "../../forms";

export const metadata: Metadata = { title: "Подтверждение входа", robots: { index: false } };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.twoFactorVerified || !session.user.totpEnabledAt) redirect("/cabinet");
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-bold">Двухфакторная защита</h1>
      <p className="mt-2 mb-8 text-muted">Введите код из приложения-аутентификатора.</p>
      <TwoFactorForm next={next} />
    </>
  );
}
