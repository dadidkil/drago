/** Доступ к переменным окружения с понятными ошибками. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Переменная окружения ${name} не задана`);
  return value;
}

export function appUrl(path = ""): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") || path === "" ? path : `/${path}`}`;
}

export const isProduction = () => process.env.NODE_ENV === "production";
