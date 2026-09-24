import { createLogger } from "../logger";
import { IspmanagerProvisioner } from "./ispmanager";

const log = createLogger("mail-provisioner");

/**
 * Управление корпоративными ящиками @dragotop.ru.
 * Реализации: Stalwart Mail Server (REST API), ISPmanager (API панели) и manual (ящики создаются у провайдера вручную).
 * Пароли никогда не логируются и не возвращаются администратору.
 */
export interface MailProvisioner {
  readonly kind: "STALWART" | "ISPMANAGER" | "MANUAL";
  /** true — провайдер реально создаёт ящики (иначе система только ведёт учёт). */
  readonly automated: boolean;
  createMailbox(input: { address: string; displayName: string; password: string; quotaMb?: number | null }): Promise<void>;
  setPassword(address: string, password: string): Promise<void>;
  /** Снять блокировку ящика (если провайдер различает блокировку и пароль). */
  enableMailbox?(address: string): Promise<void>;
  disableMailbox(address: string): Promise<void>;
  deleteMailbox(address: string): Promise<void>;
  healthcheck(): Promise<{ ok: boolean; message: string }>;
}

class ManualProvisioner implements MailProvisioner {
  readonly kind = "MANUAL" as const;
  readonly automated = false;
  async createMailbox() {}
  async setPassword() {}
  async disableMailbox() {}
  async deleteMailbox() {}
  async healthcheck() {
    return { ok: true, message: "Ручной режим: ящики создаются в панели почтового провайдера" };
  }
}

/**
 * Stalwart Mail Server management API (/api/principal).
 * Проверено по документации Stalwart v0.10–0.13; при обновлении Stalwart сверяйте формат API.
 */
class StalwartProvisioner implements MailProvisioner {
  readonly kind = "STALWART" as const;
  readonly automated = true;

  constructor(
    private readonly baseUrl: string,
    private readonly user: string,
    private readonly password: string,
  ) {}

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl.replace(/\/+$/, "")}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.user}:${this.password}`).toString("base64")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* не JSON */
    }
    if (!res.ok || (json && typeof json === "object" && "error" in json)) {
      const detail = json && typeof json === "object" ? JSON.stringify(json).slice(0, 300) : text.slice(0, 300);
      throw new Error(`Stalwart ${method} ${path}: HTTP ${res.status} ${detail}`);
    }
    return json;
  }

  private principalName(address: string): string {
    return encodeURIComponent(address.split("@")[0]!);
  }

  async createMailbox(input: { address: string; displayName: string; password: string; quotaMb?: number | null }) {
    await this.request("POST", "/api/principal", {
      type: "individual",
      name: input.address.split("@")[0],
      description: input.displayName,
      secrets: [input.password],
      emails: [input.address],
      quota: input.quotaMb ? input.quotaMb * 1024 * 1024 : 0,
      roles: ["user"],
    });
    log.info("mailbox created", { address: input.address });
  }

  async setPassword(address: string, password: string) {
    await this.request("PATCH", `/api/principal/${this.principalName(address)}`, [
      { action: "set", field: "secrets", value: [password] },
    ]);
    log.info("mailbox password reset", { address });
  }

  async disableMailbox(address: string) {
    // Отключение = удаление всех секретов: войти нельзя, письма и ящик сохраняются.
    await this.request("PATCH", `/api/principal/${this.principalName(address)}`, [
      { action: "set", field: "secrets", value: [] },
    ]);
    log.info("mailbox disabled", { address });
  }

  async deleteMailbox(address: string) {
    await this.request("DELETE", `/api/principal/${this.principalName(address)}`);
    log.info("mailbox deleted", { address });
  }

  async healthcheck() {
    try {
      await this.request("GET", "/api/principal?limit=1");
      return { ok: true, message: "Stalwart API доступен" };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}

export function getMailProvisioner(): MailProvisioner {
  const kind = (process.env.MAIL_PROVIDER ?? "manual").toLowerCase();
  if (kind === "stalwart") {
    const url = process.env.STALWART_URL;
    const user = process.env.STALWART_ADMIN_USER;
    const pass = process.env.STALWART_ADMIN_PASSWORD;
    if (!url || !user || !pass) throw new Error("MAIL_PROVIDER=stalwart, но STALWART_URL/STALWART_ADMIN_USER/STALWART_ADMIN_PASSWORD не заданы");
    return new StalwartProvisioner(url, user, pass);
  }
  if (kind === "ispmanager") {
    const url = process.env.ISPMANAGER_URL;
    const user = process.env.ISPMANAGER_USER;
    const pass = process.env.ISPMANAGER_PASSWORD;
    if (!url || !user || !pass) throw new Error("MAIL_PROVIDER=ispmanager, но ISPMANAGER_URL/ISPMANAGER_USER/ISPMANAGER_PASSWORD не заданы");
    return new IspmanagerProvisioner(url, user, pass, process.env.ISPMANAGER_TLS_VERIFY !== "false");
  }
  return new ManualProvisioner();
}

export function mailDomain(): string {
  return process.env.MAIL_DOMAIN ?? "dragotop.ru";
}
