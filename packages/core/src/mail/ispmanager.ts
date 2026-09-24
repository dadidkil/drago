import { request } from "node:https";
import { request as httpRequest } from "node:http";
import { createLogger } from "../logger";
import type { MailProvisioner } from "./provisioner";

const log = createLogger("mail-ispmanager");

/**
 * Почтовые ящики через API ISPmanager 5/6 (func=email.edit / email.suspend / email.resume / email.delete).
 * Формат вызова: POST https://<хост>:1500/ispmgr, параметры authinfo, out=json, func, sok=ok.
 * Пароли передаются ТОЛЬКО в теле POST-запроса (не в URL), чтобы не попадать в журналы.
 *
 * Рекомендуется отдельный пользователь панели — владелец почтового домена, а не root.
 */
export class IspmanagerProvisioner implements MailProvisioner {
  readonly kind = "ISPMANAGER" as const;
  readonly automated = true;

  constructor(
    private readonly baseUrl: string,
    private readonly user: string,
    private readonly password: string,
    private readonly verifyTls = true,
  ) {}

  /** Выполняет функцию панели и возвращает объект doc (или бросает ошибку с текстом панели). */
  async call(func: string, params: Record<string, string | number | undefined> = {}): Promise<Record<string, unknown>> {
    const body = new URLSearchParams();
    body.set("authinfo", `${this.user}:${this.password}`);
    body.set("out", "json");
    body.set("func", func);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, String(v));
    const url = new URL(this.baseUrl.replace(/\/+$/, "").replace(/\/ispmgr$/, "") + "/ispmgr");
    const payload = body.toString();

    const text = await new Promise<string>((resolve, reject) => {
      const req = (url.protocol === "http:" ? httpRequest : request)(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(payload) },
          timeout: 20_000,
          ...(url.protocol === "https:" ? { rejectUnauthorized: this.verifyTls } : {}),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const t = Buffer.concat(chunks).toString("utf8");
            if ((res.statusCode ?? 500) >= 400) reject(new Error(`ISPmanager HTTP ${res.statusCode}`));
            else resolve(t);
          });
        },
      );
      req.on("timeout", () => req.destroy(new Error("ISPmanager: таймаут")));
      req.on("error", reject);
      req.end(payload);
    });

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error("ISPmanager вернул не JSON (проверьте ISPMANAGER_URL)");
    }
    const doc = (json.doc ?? json) as Record<string, unknown>;
    const error = doc.error as { $type?: string; $object?: string; msg?: { $?: string } } | undefined;
    if (error) {
      const msg = error.msg?.$ ?? error.$type ?? "неизвестная ошибка";
      throw new Error(`ISPmanager ${func}: ${msg}${error.$object ? ` (${error.$object})` : ""}`);
    }
    return doc;
  }

  private split(address: string): { name: string; domain: string } {
    const [name, domain] = address.split("@");
    if (!name || !domain) throw new Error(`Некорректный адрес: ${address}`);
    return { name, domain };
  }

  async createMailbox(input: { address: string; displayName: string; password: string; quotaMb?: number | null }) {
    const { name, domain } = this.split(input.address);
    await this.call("email.edit", {
      name,
      domainname: domain,
      passwd: input.password,
      confirm: input.password,
      maxsize: input.quotaMb ?? undefined,
      note: input.displayName.slice(0, 100),
      sok: "ok",
    });
    log.info("mailbox created", { address: input.address });
  }

  async setPassword(address: string, password: string) {
    await this.call("email.edit", { elid: address, passwd: password, confirm: password, sok: "ok" });
    log.info("mailbox password reset", { address });
  }

  async enableMailbox(address: string) {
    await this.call("email.resume", { elid: address, sok: "ok" });
  }

  async disableMailbox(address: string) {
    await this.call("email.suspend", { elid: address, sok: "ok" });
    log.info("mailbox suspended", { address });
  }

  async deleteMailbox(address: string) {
    await this.call("email.delete", { elid: address, sok: "ok" });
    log.info("mailbox deleted", { address });
  }

  async healthcheck() {
    try {
      const doc = await this.call("emaildomain");
      const elems = (doc.elem as Array<Record<string, { $?: string }>> | undefined) ?? [];
      const names = elems.map((e) => e.name?.$).filter(Boolean);
      const domain = process.env.MAIL_DOMAIN ?? "dragotop.ru";
      return names.includes(domain)
        ? { ok: true, message: `ISPmanager API доступен, почтовый домен ${domain} найден` }
        : { ok: false, message: `ISPmanager API доступен, но почтового домена ${domain} нет у пользователя ${this.user}. Создайте его: Почта → Почтовые домены.` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
