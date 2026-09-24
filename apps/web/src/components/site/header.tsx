"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Wordmark } from "./brand";

const NAV = [
  { href: "/about", label: "О нас" },
  { href: "/team", label: "Команда" },
  { href: "/projects", label: "Проекты" },
  { href: "/news", label: "Новости" },
  { href: "/gallery", label: "Галерея" },
  { href: "/events", label: "События" },
  { href: "/contacts", label: "Контакты" },
];

export function SiteHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        scrolled || open ? "border-line bg-paper/90 backdrop-blur-md" : "border-transparent bg-paper",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="rounded-lg" aria-label="ТОП «Драго» — на главную">
          <Wordmark />
        </Link>

        <nav aria-label="Основное меню" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-lg px-3 py-2 text-[0.93rem] font-medium transition-colors",
                      active ? "text-fire" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <Link href={isLoggedIn ? "/cabinet" : "/login"} className={buttonClass("ghost", "sm")}>
              {isLoggedIn ? "Кабинет" : "Войти"}
            </Link>
            <Link href="/join" className={buttonClass("primary", "sm")}>
              Вступить
            </Link>
          </div>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-xl text-ink hover:bg-paper-2 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-x-0 top-16 bottom-0 overflow-y-auto border-t border-line bg-paper px-4 pb-10 lg:hidden"
      >
        <nav aria-label="Мобильное меню">
          <ul className="flex flex-col py-4">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block border-b border-line py-4 font-display text-xl font-semibold text-ink"
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-4 grid gap-3">
          <Link href="/join" className={buttonClass("primary", "lg", "w-full")}>
            Вступить в отряд
          </Link>
          <Link href={isLoggedIn ? "/cabinet" : "/login"} className={buttonClass("secondary", "lg", "w-full")}>
            {isLoggedIn ? "Личный кабинет" : "Войти в кабинет"}
          </Link>
        </div>
      </div>
    </header>
  );
}
