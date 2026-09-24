import { writeFile } from "node:fs/promises";
import { db } from "@drago/database";
import { createLogger } from "@drago/core";
import { processDeliveries } from "./deliveries";
import { cleanup, eventReminders, taskDeadlineReminders } from "./jobs";

const log = createLogger("worker");
const HEARTBEAT = process.env.WORKER_HEARTBEAT_FILE ?? "/tmp/worker-heartbeat";
let stopping = false;

function every(name: string, ms: number, fn: () => Promise<unknown>) {
  let running = false;
  const tick = async () => {
    if (stopping || running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      log.error(`${name} failed`, { err });
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(tick, ms);
}

async function main() {
  await db.$queryRaw`SELECT 1`;
  log.info("worker started");
  const timers = [
    every("deliveries", 5_000, async () => {
      // Выбираем очередь до конца, но не дольше одного тика.
      for (let i = 0; i < 10 && !stopping; i++) if ((await processDeliveries()) === 0) break;
    }),
    every("reminders", 60_000, async () => {
      await taskDeadlineReminders();
      await eventReminders();
    }),
    every("cleanup", 60 * 60_000, cleanup),
    every("heartbeat", 30_000, () => writeFile(HEARTBEAT, String(Date.now()))),
  ];

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info("shutting down", { signal });
    timers.forEach(clearInterval);
    await new Promise((r) => setTimeout(r, 2000));
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  log.error("fatal", { err });
  process.exit(1);
});
