import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Вход в кабинет", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string; reset?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, reset } = await searchParams;
  if (await getCurrentUser()) redirect("/cabinet");
  return (
    <>
      <h1 className="text-3xl font-bold">Вход</h1>
      <p className="mt-2 mb-8 text-muted">Для бойцов и командного состава ТОП «Драго».</p>
      {reset && <p className="mb-5 rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-success">Пароль изменён. Войдите с новым паролем.</p>}
      <LoginForm next={next} />
      <p className="mt-10 text-sm text-muted">
        Аккаунты создаёт командный состав. Хочешь в отряд?{" "}
        <a href="/join" className="font-semibold text-fire hover:underline">
          Оставь заявку
        </a>
        .
      </p>
    </>
  );
}
