import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/site/section";

export const metadata: Metadata = { title: "Нет доступа", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <Container className="flex min-h-[60svh] flex-col items-start justify-center py-20">
      <p className="font-display text-7xl font-bold text-fire">403</p>
      <h1 className="mt-4 text-3xl font-semibold">Нет доступа к этому разделу</h1>
      <p className="mt-3 max-w-xl text-muted">Если вы считаете, что это ошибка, обратитесь к командиру или администратору.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/cabinet" className={buttonClass("primary")}>
          В кабинет
        </Link>
        <Link href="/" className={buttonClass("ghost")}>
          На главную
        </Link>
      </div>
    </Container>
  );
}
