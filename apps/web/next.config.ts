import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Монорепозиторий: трассируем зависимости от корня, чтобы standalone-сборка включала workspace-пакеты.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Исходники не нужны в standalone-образе (трассировщик захватывает их из-за динамических путей fs).
  outputFileTracingExcludes: { "*": ["./src/**", "./*.md", "./vitest.config.ts", "./tsconfig.tsbuildinfo"] },
  transpilePackages: ["@drago/shared", "@drago/core", "@drago/database"],
  serverExternalPackages: ["@node-rs/argon2", "sharp"],
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: false,
  images: {
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/images/**" }],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    serverActions: {
      // Загрузка документов до 25 МБ + накладные расходы multipart.
      bodySizeLimit: "26mb",
    },
    proxyClientMaxBodySize: "26mb",
  },
  // Короткие адреса разделов кабинета из ТЗ: /dashboard, /profile, … → /cabinet/…
  async redirects() {
    return ["dashboard", "profile", "announcements", "tasks", "documents", "calendar", "mail", "help"].map((section) => ({
      source: `/${section}`,
      destination: `/cabinet/${section}`,
      permanent: false,
    }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/fonts/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
