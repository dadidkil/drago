import type { Metadata } from "next";
import QRCode from "qrcode";
import { Monitor, ShieldAlert, ShieldCheck } from "lucide-react";
import { db } from "@drago/database";
import { decryptSecret } from "@drago/core";
import { formatDateTime } from "@drago/shared";
import { InlineAction } from "@/components/ui/form";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/current-user";
import { totpUri } from "@/lib/auth/totp";
import { revokeOtherSessions, revokeSession, unlinkMessenger } from "./actions";
import {
  ChangePasswordForm,
  ConfirmTotpForm,
  DisableTotpForm,
  RegenerateCodesForm,
  StartTotpForm,
  TelegramLinkForm,
  VkLinkForm,
} from "./forms";

export const metadata: Metadata = { title: "Безопасность" };

function describeAgent(ua: string | null): string {
  if (!ua) return "Неизвестное устройство";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "";
  const browser = /YaBrowser/i.test(ua) ? "Яндекс Браузер" : /Edg\//i.test(ua) ? "Edge" : /Firefox/i.test(ua) ? "Firefox" : /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : "Браузер";
  return [browser, os].filter(Boolean).join(", ");
}

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ require2fa?: string }> }) {
  const user = await requireUser();
  const { require2fa } = await searchParams;
  const [row, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        totpSecretEnc: true,
        totpEnabledAt: true,
        recoveryCodeHashes: true,
        telegramAccount: { select: { username: true, firstName: true, linkedAt: true } },
        vkAccount: { select: { vkUserId: true, linkedAt: true } },
      },
    }),
    db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
  ]);

  let qr: string | null = null;
  let secret: string | null = null;
  if (row.totpSecretEnc && !row.totpEnabledAt) {
    secret = decryptSecret(row.totpSecretEnc);
    qr = await QRCode.toDataURL(totpUri(secret, user.email), { margin: 1, width: 220 });
  }

  return (
    <>
      <PageHeader title="Безопасность" description="Пароль, двухфакторная защита, активные сессии и мессенджеры." />
      {require2fa && !user.has2fa && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/40 bg-[#fdf3e0] p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm">
            <span className="font-semibold">Для доступа к админ-панели нужна двухфакторная аутентификация.</span> Включите её ниже — это займёт минуту.
          </p>
        </div>
      )}
      <div className="grid gap-6">
        <Card>
          <h2 id="twofa" className="flex items-center gap-2 text-lg font-semibold">
            {user.has2fa ? <ShieldCheck className="size-5 text-success" /> : <ShieldAlert className="size-5 text-warning" />}
            Двухфакторная аутентификация
            {user.has2fa ? <Badge tone="success">включена</Badge> : <Badge tone="warning">выключена</Badge>}
          </h2>
          <p className="mt-2 text-sm text-muted">
            При входе кроме пароля понадобится код из приложения (Google Authenticator, Яндекс Ключ, Microsoft Authenticator, Aegis и др.).
          </p>
          <div className="mt-5">
            {user.has2fa ? (
              <div className="grid gap-6">
                <p className="text-sm">
                  Осталось резервных кодов: <span className="font-semibold">{row.recoveryCodeHashes.length}</span>
                </p>
                <RegenerateCodesForm />
                <details className="rounded-xl border border-line p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Отключить 2FA</summary>
                  <div className="mt-4">
                    <DisableTotpForm />
                  </div>
                </details>
              </div>
            ) : qr && secret ? (
              <div className="grid gap-5 md:grid-cols-[auto_1fr]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR-код для приложения-аутентификатора" width={220} height={220} className="rounded-xl border border-line" />
                <div className="grid content-start gap-4">
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    <li>Отсканируйте QR-код в приложении-аутентификаторе.</li>
                    <li>
                      Или введите ключ вручную: <code className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-xs break-all select-all">{secret}</code>
                    </li>
                    <li>Введите 6-значный код из приложения.</li>
                  </ol>
                  <ConfirmTotpForm />
                </div>
              </div>
            ) : (
              <StartTotpForm />
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Смена пароля</h2>
          <ChangePasswordForm />
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Активные сессии</h2>
            {sessions.length > 1 && <InlineAction action={revokeOtherSessions} fields={{}} label="Завершить все, кроме текущей" variant="secondary" confirm="Завершить все остальные сессии?" />}
          </div>
          <ul className="divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Monitor className="size-5 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {describeAgent(s.userAgent)} {s.id === user.session.id && <Badge tone="success">текущая</Badge>}
                  </p>
                  <p className="text-muted">
                    {s.ipAddress ?? "IP неизвестен"} · активность {formatDateTime(s.lastSeenAt)} · вход {formatDateTime(s.createdAt)}
                  </p>
                </div>
                {s.id !== user.session.id && <InlineAction action={revokeSession} fields={{ sessionId: s.id }} label="Завершить" />}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 id="messengers" className="mb-1 text-lg font-semibold">
            Мессенджеры
          </h2>
          <p className="mb-5 text-sm text-muted">Для уведомлений и быстрого доступа к задачам и мероприятиям. Привязка — только по одноразовому коду.</p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-line p-4">
              <p className="font-semibold">Telegram</p>
              {row.telegramAccount ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span>
                    Подключён{row.telegramAccount.username ? ` как @${row.telegramAccount.username}` : ""} · {formatDateTime(row.telegramAccount.linkedAt)}
                  </span>
                  <InlineAction action={unlinkMessenger} fields={{ channel: "TELEGRAM" }} label="Отвязать" confirm="Отвязать Telegram?" />
                </div>
              ) : (
                <div className="mt-3">
                  <TelegramLinkForm />
                </div>
              )}
            </div>
            <div className="rounded-xl border border-line p-4">
              <p className="font-semibold">ВКонтакте</p>
              {row.vkAccount ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span>Подключён · {formatDateTime(row.vkAccount.linkedAt)}</span>
                  <InlineAction action={unlinkMessenger} fields={{ channel: "VK" }} label="Отвязать" confirm="Отвязать ВКонтакте?" />
                </div>
              ) : (
                <div className="mt-3">
                  <VkLinkForm />
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
