import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="bg-scales flex min-h-svh flex-col items-center justify-center bg-ink px-4 text-center text-paper">
      <p className="font-display text-8xl font-bold text-fire-bright">404</p>
      <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">Такой страницы нет</h1>
      <p className="mt-3 max-w-md text-muted-dark">Возможно, её перенесли или удалили. Дракон проверил везде — пусто.</p>
      <Link href="/" className={buttonClass("primary", "lg", "mt-8")}>
        На главную
      </Link>
    </main>
  );
}
