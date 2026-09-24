import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ТОП «Драго» — трудовой отряд подростков Москвы",
    template: "%s — ТОП «Драго»",
  },
  description:
    "ТОП «Драго» — трудовой отряд подростков Москвы (РСО). Первая работа, настоящая команда и яркое трудовое лето для ребят 14–17 лет.",
  applicationName: "ТОП «Драго»",
  keywords: ["ТОП Драго", "трудовой отряд подростков", "ТОП Москвы", "РСО", "работа для подростков", "студенческие отряды"],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "ТОП «Драго»",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ТОП «Драго»" }],
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#15131a",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Строгий CSP с nonce требует рендеринга на каждый запрос: статичный HTML не получил бы nonce.
  await connection();
  return (
    <html lang="ru">
      <head>
        <link rel="preload" href="/fonts/unbounded-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/onest-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-svh">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Перейти к содержимому
        </a>
        {children}
      </body>
    </html>
  );
}
