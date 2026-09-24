import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/site/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <div className="bg-scales relative hidden overflow-hidden bg-ink p-12 text-paper lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -top-24 -left-24 size-96 rounded-full bg-fire-bright/25 blur-3xl" />
        <div aria-hidden className="absolute right-0 bottom-0 size-80 rounded-full bg-water-bright/15 blur-3xl" />
        <Link href="/" className="relative">
          <Wordmark dark />
        </Link>
        <div className="relative">
          <p className="font-display text-4xl leading-tight font-bold">
            Личный кабинет
            <br />
            бойца «Драго»
          </p>
          <p className="mt-4 max-w-sm text-muted-dark">Объявления, задачи, мероприятия и документы отряда — в одном месте.</p>
        </div>
        <p className="relative text-xs text-muted-dark">Огонь, вода, земля и воздух.</p>
      </div>
      <main id="main" className="flex flex-col px-4 py-8 sm:px-8">
        <Link href="/" className="lg:hidden">
          <Wordmark />
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
