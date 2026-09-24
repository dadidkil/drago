import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (бывший middleware):
 *  1) строгий CSP с nonce для каждого запроса;
 *  2) защита от CSRF для мутирующих запросов: Origin обязателен и должен совпадать с хостом
 *     (Next.js сам проверяет Origin у Server Actions, но пропускает запросы без Origin);
 *  3) быстрый редирект на /login для закрытых зон без cookie (полная проверка сессии — на сервере).
 */

const SESSION_COOKIES = ["__Host-drago_session", "drago_session"];
const PROTECTED_PREFIXES = ["/cabinet", "/admin"];

function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Инлайн-атрибуты style используются React/Next для отдельных элементов; скрипты при этом под nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function expectedHost(request: NextRequest): string | null {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const isDev = process.env.NODE_ENV === "development";

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const origin = request.headers.get("origin");
    const host = expectedHost(request);
    let sameOrigin = false;
    if (origin && host) {
      try {
        sameOrigin = new URL(origin).host === host;
      } catch {
        sameOrigin = false;
      }
    }
    if (!sameOrigin) {
      return new NextResponse("Forbidden: cross-origin request", { status: 403 });
    }
  }

  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
    if (!hasSession && method === "GET") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, isDev);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (!isDev) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) || pathname.startsWith("/auth") || pathname === "/login") {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|fonts/|images/|media/|favicon.ico|icon.svg|robots.txt|sitemap.xml|manifest.webmanifest|og.png).*)",
    },
  ],
};
