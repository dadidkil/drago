import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "fire" | "water" | "earth" | "air" | "success" | "warning" | "danger" | "dark";

const tones: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-2",
  fire: "bg-fire-soft text-[#8f2508]",
  water: "bg-[#e3f0fb] text-water",
  earth: "bg-[#e8f3e2] text-earth",
  air: "bg-[#ecebff] text-air",
  success: "bg-[#e7f5ec] text-success",
  warning: "bg-[#fdf3e0] text-warning",
  danger: "bg-[#fdecea] text-danger",
  dark: "bg-ink text-paper",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-line bg-white p-5 sm:p-6", className)}>{children}</div>;
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-fire uppercase">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-display font-semibold text-paper", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {letters || "?"}
    </span>
  );
}
