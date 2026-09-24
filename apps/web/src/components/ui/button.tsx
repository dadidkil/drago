import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light" | "outline-light";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,color,box-shadow,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px";

const variants: Record<Variant, string> = {
  primary: "bg-fire text-white shadow-[0_8px_24px_-12px_rgb(201_53_16/0.8)] hover:bg-[#b02d0b]",
  secondary: "bg-ink text-paper hover:bg-ink-2",
  ghost: "bg-transparent text-ink hover:bg-paper-2",
  danger: "bg-danger text-white hover:bg-[#971c12]",
  light: "bg-paper text-ink hover:bg-white",
  "outline-light": "border border-white/30 text-paper hover:border-white/70 hover:bg-white/5",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string; variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
