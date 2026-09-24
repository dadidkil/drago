export const SITE_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
