export const TIME_ZONE = "Europe/Moscow";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" });
const dateShortFmt = new Intl.DateTimeFormat("ru-RU", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("ru-RU", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
const weekdayFmt = new Intl.DateTimeFormat("ru-RU", { timeZone: TIME_ZONE, weekday: "short" });

export const formatDate = (d: Date) => dateFmt.format(d);
export const formatDateShort = (d: Date) => dateShortFmt.format(d);
export const formatTime = (d: Date) => timeFmt.format(d);
export const formatDateTime = (d: Date) => dateTimeFmt.format(d);
export const formatWeekday = (d: Date) => weekdayFmt.format(d);

/** Части даты в московском времени. */
export function moscowParts(d: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Значение для <input type="datetime-local"> в московском времени. */
export function toMoscowInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  const p = moscowParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Разбор значения <input type="datetime-local">, введённого по Москве (UTC+3, без перехода на летнее время). */
export function parseMoscowInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00"] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:00+03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function fullName(p: { lastName: string; firstName: string; middleName?: string | null } | null | undefined): string {
  if (!p) return "Без имени";
  return [p.lastName, p.firstName].filter(Boolean).join(" ");
}

export function initials(p: { lastName: string; firstName: string } | null | undefined): string {
  if (!p) return "?";
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
}

/** Экранирование для Telegram HTML parse_mode. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}
