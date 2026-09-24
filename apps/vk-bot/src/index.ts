import { db } from "@drago/database";
import { createLogger } from "@drago/core";
import { handleEvent } from "./bot";
import { startServer } from "./server";

const log = createLogger("vk-bot");

async function main() {
  const groupId = Number(process.env.VK_GROUP_ID);
  const secret = process.env.VK_CALLBACK_SECRET ?? "";
  const confirmationCode = process.env.VK_CONFIRMATION_CODE ?? "";
  if (!groupId || secret.length < 8 || !confirmationCode) {
    log.warn("VK_GROUP_ID / VK_CALLBACK_SECRET (≥8 символов) / VK_CONFIRMATION_CODE не заданы — сервер отвечает только на /health");
  }
  await db.$queryRaw`SELECT 1`;
  const server = startServer({
    port: Number(process.env.PORT ?? 3002),
    groupId: groupId || -1,
    // Без настроенного секрета любые запросы отклоняются (пустой секрет не совпадёт со случайным значением).
    secret: secret.length >= 8 ? secret : crypto.randomUUID(),
    confirmationCode,
    onEvent: handleEvent,
  });
  const stop = (signal: string) => {
    log.info("stopping", { signal });
    server.close(() => void db.$disconnect().then(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
}

main().catch((err) => {
  log.error("fatal", { err });
  process.exit(1);
});
