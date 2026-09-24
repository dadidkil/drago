import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "../../forms";

export const metadata: Metadata = { title: "Восстановление пароля", robots: { index: false } };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Восстановление пароля</h1>
      <p className="mt-2 mb-8 text-muted">Укажите email аккаунта — пришлём ссылку для сброса пароля.</p>
      <ForgotForm />
      <Link href="/login" className="mt-8 inline-block text-sm font-semibold text-fire">
        ← Вернуться ко входу
      </Link>
    </>
  );
}
