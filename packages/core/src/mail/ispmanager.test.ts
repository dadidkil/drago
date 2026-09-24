import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IspmanagerProvisioner } from "./ispmanager";

let server: Server;
let base = "";
const calls: { url: string; params: URLSearchParams }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const params = new URLSearchParams(body);
      calls.push({ url: req.url ?? "", params });
      res.setHeader("content-type", "application/json");
      if (params.get("authinfo") !== "drago:secret") return res.end(JSON.stringify({ doc: { error: { $type: "auth", msg: { $: "Неверный логин" } } } }));
      if (params.get("func") === "email.edit" && params.get("name") === "exists") {
        return res.end(JSON.stringify({ doc: { error: { $type: "exists", $object: "email", msg: { $: "Ящик уже существует" } } } }));
      }
      if (params.get("func") === "emaildomain") return res.end(JSON.stringify({ doc: { elem: [{ name: { $: "dragotop.ru" } }] } }));
      res.end(JSON.stringify({ doc: { ok: {} } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

describe("IspmanagerProvisioner", () => {
  const p = () => new IspmanagerProvisioner(base, "drago", "secret");

  it("creates a mailbox via POST email.edit without leaking the password into the URL", async () => {
    await p().createMailbox({ address: "ivan.ivanov@dragotop.ru", displayName: "Иван Иванов", password: "Tmp-Pass-123", quotaMb: 2048 });
    const c = calls.at(-1)!;
    expect(c.url).toBe("/ispmgr");
    expect(c.url).not.toContain("Tmp-Pass");
    expect(Object.fromEntries(c.params)).toMatchObject({
      func: "email.edit",
      out: "json",
      name: "ivan.ivanov",
      domainname: "dragotop.ru",
      passwd: "Tmp-Pass-123",
      confirm: "Tmp-Pass-123",
      maxsize: "2048",
      sok: "ok",
    });
  });

  it("uses elid for password reset, suspend, resume and delete", async () => {
    await p().setPassword("ivan.ivanov@dragotop.ru", "New-Pass-456");
    expect(calls.at(-1)!.params.get("elid")).toBe("ivan.ivanov@dragotop.ru");
    await p().disableMailbox("ivan.ivanov@dragotop.ru");
    expect(calls.at(-1)!.params.get("func")).toBe("email.suspend");
    await p().enableMailbox("ivan.ivanov@dragotop.ru");
    expect(calls.at(-1)!.params.get("func")).toBe("email.resume");
    await p().deleteMailbox("ivan.ivanov@dragotop.ru");
    expect(calls.at(-1)!.params.get("func")).toBe("email.delete");
  });

  it("surfaces panel errors", async () => {
    await expect(p().createMailbox({ address: "exists@dragotop.ru", displayName: "x", password: "x" })).rejects.toThrow("Ящик уже существует");
    await expect(new IspmanagerProvisioner(base, "drago", "wrong").healthcheck()).resolves.toMatchObject({ ok: false });
  });

  it("healthcheck finds the mail domain", async () => {
    process.env.MAIL_DOMAIN = "dragotop.ru";
    await expect(p().healthcheck()).resolves.toMatchObject({ ok: true });
  });
});
