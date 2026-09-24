type Level = "debug" | "info" | "warn" | "error";
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = LEVELS[(process.env.LOG_LEVEL as Level) ?? "info"] ?? 20;

function serializeError(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return err;
}

/** Структурированный JSON-лог в stdout — удобно для `docker compose logs` и сборщиков логов. */
export function createLogger(service: string) {
  const log = (level: Level, msg: string, extra?: Record<string, unknown>) => {
    if (LEVELS[level] < minLevel) return;
    const entry: Record<string, unknown> = { ts: new Date().toISOString(), level, service, msg };
    if (extra) {
      for (const [k, v] of Object.entries(extra)) entry[k] = k === "err" ? serializeError(v) : v;
    }
    const line = JSON.stringify(entry, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    if (level === "error" || level === "warn") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  };
  return {
    debug: (msg: string, extra?: Record<string, unknown>) => log("debug", msg, extra),
    info: (msg: string, extra?: Record<string, unknown>) => log("info", msg, extra),
    warn: (msg: string, extra?: Record<string, unknown>) => log("warn", msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) => log("error", msg, extra),
  };
}

export type Logger = ReturnType<typeof createLogger>;
