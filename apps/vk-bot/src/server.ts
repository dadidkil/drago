import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createLogger, markProcessed, rateLimit, safeEqual } from "@drago/core";

const log = createLogger("vk-bot:http");
const MAX_BODY = 64 * 1024;

export interface VkCallback {
  type: string;
  group_id: number;
  event_id?: string;
  secret?: string;
  v?: string;
  object?: unknown;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(body);
}

/**
 * HTTP-сервер VK Callback API.
 *  - принимает только POST /vk/callback с JSON до 64 КБ;
 *  - проверяет group_id и секретный ключ (сравнение с постоянным временем);
 *  - на `confirmation` отвечает строкой подтверждения;
 *  - на события сразу отвечает «ok» (VK ждёт ответ до 10 с и повторяет доставку),
 *    а обработку выполняет асинхронно, с защитой от повторов по event_id.
 */
export function startServer(opts: {
  port: number;
  groupId: number;
  secret: string;
  confirmationCode: string;
  onEvent: (event: VkCallback) => Promise<void>;
}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && url.pathname === "/health") return send(res, 200, "ok");
      if (url.pathname !== "/vk/callback") return send(res, 404, "not found");
      if (req.method !== "POST") return send(res, 405, "method not allowed");

      const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
      const limit = await rateLimit(`vk-cb:${ip}`, 600, 60);
      if (!limit.ok) return send(res, 429, "too many requests");

      let event: VkCallback;
      try {
        event = JSON.parse(await readBody(req)) as VkCallback;
      } catch {
        return send(res, 400, "bad request");
      }
      if (!event || typeof event.type !== "string" || typeof event.group_id !== "number") return send(res, 400, "bad request");
      if (event.group_id !== opts.groupId) {
        log.warn("wrong group_id", { groupId: event.group_id, ip });
        return send(res, 403, "forbidden");
      }
      if (!safeEqual(String(event.secret ?? ""), opts.secret)) {
        log.warn("bad secret", { type: event.type, ip });
        return send(res, 403, "forbidden");
      }
      if (event.type === "confirmation") return send(res, 200, opts.confirmationCode);

      send(res, 200, "ok");
      const id = event.event_id ?? null;
      if (id && !(await markProcessed("vk", id))) {
        log.debug("duplicate event skipped", { id });
        return;
      }
      opts.onEvent(event).catch((err) => log.error("event handler failed", { err, type: event.type }));
    } catch (err) {
      log.error("request failed", { err });
      if (!res.headersSent) send(res, 500, "error");
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.listen(opts.port, "0.0.0.0", () => log.info("listening", { port: opts.port }));
  return server;
}
