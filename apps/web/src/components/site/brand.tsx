import { cn } from "@/components/ui/cn";

/**
 * Знак «Драго»: четыре языка-стихии (огонь, вода, земля, воздух), закрученные вокруг
 * вертикального «драконьего зрачка». Цвета стихий — из дизайн-токенов.
 */
export function DragoMark({ className, title = "ТОП «Драго»" }: { className?: string; title?: string }) {
  const petal = "M32 5 C41 13 42 23 33.5 30 C31 22 26 14 32 5 Z";
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} role="img" aria-label={title}>
      <g>
        <path d={petal} fill="#ff6a3d" />
        <path d={petal} fill="#4fb3ff" transform="rotate(90 32 32)" />
        <path d={petal} fill="#8fd16a" transform="rotate(180 32 32)" />
        <path d={petal} fill="#a9a4ff" transform="rotate(270 32 32)" />
      </g>
      <circle cx="32" cy="32" r="9" fill="#15131a" />
      <ellipse cx="32" cy="32" rx="2.4" ry="7" fill="#ff6a3d" />
    </svg>
  );
}

export function Wordmark({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <DragoMark className="size-9" />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-[1.05rem] font-bold tracking-wide", dark ? "text-paper" : "text-ink")}>ДРАГО</span>
        <span className={cn("mt-0.5 text-[0.62rem] font-semibold tracking-[0.18em] uppercase", dark ? "text-muted-dark" : "text-muted")}>
          трудовой отряд
        </span>
      </span>
    </span>
  );
}

export function VkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12.9 17.5c-5.5 0-8.6-3.8-8.8-10h2.8c.1 4.6 2.1 6.5 3.7 6.9V7.5h2.6v3.9c1.6-.2 3.3-2 3.8-3.9h2.6c-.4 2.4-2.2 4.2-3.4 4.9 1.3.6 3.3 2.1 4.1 5.1h-2.9c-.6-1.9-2.1-3.4-4.2-3.6v3.6h-.3Z" />
    </svg>
  );
}

export function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M20.7 4.3 3.4 11c-1.2.5-1.2 1.2-.2 1.5l4.4 1.4 1.7 5.2c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.1-2.1 4.5 3.3c.8.5 1.4.2 1.6-.8l2.9-13.7c.3-1.2-.5-1.8-1.4-1.4ZM8.9 13.6l8.8-5.6c.4-.3.8-.1.5.2l-7.4 6.7-.3 3.2-1.6-4.5Z" />
    </svg>
  );
}

export const ELEMENTS = [
  { key: "fire", label: "Огонь", text: "энергия и драйв", color: "text-fire-bright", bg: "bg-fire-bright" },
  { key: "water", label: "Вода", text: "гибкость и поддержка", color: "text-water-bright", bg: "bg-water-bright" },
  { key: "earth", label: "Земля", text: "надёжность и труд", color: "text-earth-bright", bg: "bg-earth-bright" },
  { key: "air", label: "Воздух", text: "свобода и идеи", color: "text-air-bright", bg: "bg-air-bright" },
] as const;
