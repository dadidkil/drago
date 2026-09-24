import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/components/ui/cn";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  className,
  more,
  dark = false,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
  more?: { href: string; label: string };
  dark?: boolean;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("py-16 sm:py-24", dark && "bg-ink text-paper", className)}>
      <Container>
        <div className="mb-10 flex flex-col gap-4 sm:mb-14 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            {eyebrow && (
              <p className={cn("mb-3 text-xs font-semibold tracking-[0.18em] uppercase", dark ? "text-fire-bright" : "text-fire")}>
                {eyebrow}
              </p>
            )}
            <h2 id={headingId} className="text-3xl leading-tight font-semibold sm:text-4xl lg:text-5xl">
              {title}
            </h2>
            {lead && <div className={cn("mt-4 text-lg leading-relaxed", dark ? "text-muted-dark" : "text-muted")}>{lead}</div>}
          </div>
          {more && (
            <Link
              href={more.href}
              className={cn(
                "group inline-flex shrink-0 items-center gap-2 font-semibold",
                dark ? "text-fire-bright" : "text-fire",
              )}
            >
              {more.label}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          )}
        </div>
        {children}
      </Container>
    </section>
  );
}

export function PageHero({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: ReactNode }) {
  return (
    <div className="bg-scales relative overflow-hidden bg-ink text-paper">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-fire-bright/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-water-bright/15 blur-3xl" />
      <Container className="relative py-14 sm:py-20">
        {eyebrow && <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-fire-bright uppercase">{eyebrow}</p>}
        <h1 className="max-w-4xl text-4xl leading-[1.05] font-bold sm:text-5xl lg:text-6xl">{title}</h1>
        {lead && <div className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-dark">{lead}</div>}
      </Container>
    </div>
  );
}
