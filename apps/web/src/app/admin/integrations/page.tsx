import type { Metadata } from "next";
import { db } from "@drago/database";
import { appUrl, getMailProvisioner, getSetting, isMailerConfigured } from "@drago/core";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth/current-user";
import { IntegrationsForm, TestEmailButton } from "./forms";

export const metadata: Metadata = { title: "Интеграции" };

async function telegramStatus(): Promise<{ ok: boolean; text: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, text: "TELEGRAM_BOT_TOKEN не задан в .env" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    const json = (await res.json()) as { ok: boolean; result?: { username: string } };
    return json.ok ? { ok: true, text: `Бот @${json.result?.username} отвечает` } : { ok: false, text: "Telegram отклонил токен" };
  } catch {
    return { ok: false, text: "Не удалось связаться с api.telegram.org" };
  }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium break-all sm:text-right">{value}</dd>
    </div>
  );
}

export default async function IntegrationsPage() {
  await requireAdmin("integrations.manage");
  const [tg, settings, tgLinked, vkLinked, mailHealth] = await Promise.all([
    telegramStatus(),
    getSetting("integrations"),
    db.telegramAccount.count(),
    db.vkAccount.count(),
    getMailProvisioner().healthcheck(),
  ]);
  const vkConfigured = Boolean(process.env.VK_ACCESS_TOKEN && process.env.VK_CALLBACK_SECRET && process.env.VK_GROUP_ID);

  return (
    <>
      <PageHeader title="Интеграции" description="Токены и пароли хранятся только в .env на сервере и здесь не отображаются." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            Telegram-бот <Badge tone={tg.ok ? "success" : "warning"}>{tg.ok ? "работает" : "не настроен"}</Badge>
          </h2>
          <dl className="mt-3 divide-y divide-line">
            <Row label="Статус" value={tg.text} />
            <Row label="Режим" value="long polling (входящий порт не нужен)" />
            <Row label="Привязано аккаунтов" value={tgLinked} />
          </dl>
        </Card>
        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            VK-бот сообщества <Badge tone={vkConfigured ? "success" : "warning"}>{vkConfigured ? "настроен" : "не настроен"}</Badge>
          </h2>
          <dl className="mt-3 divide-y divide-line">
            <Row label="Адрес Callback API" value={<code>{appUrl("/vk/callback")}</code>} />
            <Row label="ID сообщества" value={process.env.VK_GROUP_ID || "—"} />
            <Row label="Версия API" value={process.env.VK_API_VERSION || "5.199"} />
            <Row label="Секретный ключ" value={process.env.VK_CALLBACK_SECRET ? "задан" : "не задан"} />
            <Row label="Привязано аккаунтов" value={vkLinked} />
          </dl>
          <p className="mt-3 text-xs text-muted">Настройка: Управление сообществом → Работа с API → Callback API. Подробно — docs/bots.md.</p>
        </Card>
        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            Исходящая почта (SMTP) <Badge tone={isMailerConfigured() ? "success" : "warning"}>{isMailerConfigured() ? "настроена" : "не настроена"}</Badge>
          </h2>
          <dl className="mt-3 divide-y divide-line">
            <Row label="Сервер" value={process.env.SMTP_HOST || "—"} />
            <Row label="Отправитель" value={process.env.MAIL_FROM || "—"} />
          </dl>
          <div className="mt-4">
            <TestEmailButton />
          </div>
        </Card>
        <Card>
          <h2 className="flex items-center gap-2 font-semibold">
            Почтовые ящики <Badge tone={mailHealth.ok ? "success" : "danger"}>{mailHealth.ok ? "OK" : "ошибка"}</Badge>
          </h2>
          <p className="mt-3 text-sm">{mailHealth.message}</p>
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="mb-4 font-semibold">Параметры интеграций</h2>
        <IntegrationsForm s={settings} />
      </Card>
    </>
  );
}
