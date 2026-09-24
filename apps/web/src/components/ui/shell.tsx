"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/site/brand";
import { cn } from "./cn";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

function NavList({ groups, pathname }: { groups: NavGroup[]; pathname: string }) {
  return (
    <nav aria-label="Навигация по разделу" className="flex flex-col gap-6">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.title && <p className="mb-2 px-3 text-[0.68rem] font-semibold tracking-[0.16em] text-muted-dark uppercase">{g.title}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/cabinet" && item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.93rem] font-medium transition-colors [&_svg]:size-[1.1rem] [&_svg]:shrink-0",
                      active ? "bg-white/10 text-paper" : "text-paper/70 hover:bg-white/5 hover:text-paper",
                    )}
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-fire-bright px-2 py-0.5 text-xs font-bold text-ink">{item.badge > 99 ? "99+" : item.badge}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Каркас кабинета и админки: боковое меню (на мобильных — выезжающее), верхняя панель, контент. */
export function AppShell({
  groups,
  title,
  user,
  footer,
  topRight,
  children,
}: {
  groups: NavGroup[];
  title: string;
  user: ReactNode;
  footer?: ReactNode;
  topRight?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const sidebar = (
    <div className="bg-scales flex h-full flex-col bg-ink px-4 py-5 text-paper">
      <div className="mb-6 flex items-center justify-between px-2">
        <Link href="/" aria-label="На сайт">
          <Wordmark dark />
        </Link>
      </div>
      <p className="mb-4 px-3 text-xs font-semibold tracking-[0.16em] text-fire-bright uppercase">{title}</p>
      <div className="-mx-1 flex-1 overflow-y-auto px-1">
        <NavList groups={groups} pathname={pathname} />
      </div>
      {footer && <div className="mt-4 border-t border-white/10 pt-4">{footer}</div>}
    </div>
  );

  return (
    <div className="min-h-svh bg-paper lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-svh lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Меню">
          <button type="button" className="absolute inset-0 bg-ink/60" aria-label="Закрыть меню" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] shadow-2xl">{sidebar}</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 inline-flex size-10 items-center justify-center rounded-xl bg-paper text-ink"
            aria-label="Закрыть меню"
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-paper-2 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Открыть меню"
            aria-expanded={open}
          >
            <Menu className="size-6" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2 sm:gap-3">
            {topRight}
            {user}
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
