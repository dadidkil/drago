/**
 * Служебные команды (запуск на сервере):
 *   pnpm admin:invite --email you@dragotop.ru [--first Имя --last Фамилия]
 *     → заводит владельца системы (полный доступ, роль в отряде — кандидат) или
 *       перевыпускает приглашение, печатает одноразовую ссылку для установки пароля.
 *   pnpm --filter @drago/database cli reset-link --email user@example.com
 *     → ссылка сброса пароля (на случай, если SMTP ещё не настроен).
 */
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";
import { config as loadEnv } from "dotenv";
import { db } from "./index";

loadEnv({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const [command, ...rest] = process.argv.slice(2);
const { values } = parseArgs({
  args: rest,
  options: { email: { type: "string" }, first: { type: "string" }, last: { type: "string" } },
});

function token() {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: createHash("sha256").update(raw).digest("hex") };
}

function appUrl(p: string) {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}${p}`;
}

async function inviteOwner() {
  const email = values.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Укажите --email");
  // Роль в отряде владельцу не важна: доступ даёт признак isOwner, поэтому берём самую нижнюю.
  const role = await db.role.findUniqueOrThrow({ where: { key: "CANDIDATE" } });
  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      roleId: role.id,
      isOwner: true,
      status: "INVITED",
      profile: { create: { firstName: values.first ?? "Владелец", lastName: values.last ?? "" } },
    },
    update: { isOwner: true },
  });
  const t = token();
  await db.authToken.deleteMany({ where: { userId: user.id, type: "INVITE", usedAt: null } });
  await db.authToken.create({
    data: { userId: user.id, type: "INVITE", tokenHash: t.hash, expiresAt: new Date(Date.now() + 72 * 3600_000) },
  });
  await db.auditLog.create({
    data: { action: "user.invite_owner_cli", entity: "User", entityId: user.id, metadata: { email } },
  });
  console.log(`\nВладелец системы: ${email}`);
  console.log(`Одноразовая ссылка для установки пароля (72 часа):\n\n  ${appUrl(`/auth/invite?token=${t.raw}`)}\n`);
  console.log("После входа включите двухфакторную аутентификацию в разделе «Безопасность».");
}

async function resetLink() {
  const email = values.email?.trim().toLowerCase();
  if (!email) throw new Error("Укажите --email");
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const t = token();
  await db.authToken.create({
    data: { userId: user.id, type: "PASSWORD_RESET", tokenHash: t.hash, expiresAt: new Date(Date.now() + 3600_000) },
  });
  await db.auditLog.create({ data: { action: "user.reset_link_cli", entity: "User", entityId: user.id } });
  console.log(`Ссылка сброса пароля (1 час):\n\n  ${appUrl(`/auth/reset?token=${t.raw}`)}\n`);
}

const commands: Record<string, () => Promise<void>> = {
  "invite-owner": inviteOwner,
  "reset-link": resetLink,
};

const fn = command ? commands[command] : undefined;
if (!fn) {
  console.error(`Команды: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}
fn()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
