/**
 * Начальное заполнение БД. Идемпотентно: повторный запуск ничего не ломает
 * и НЕ перезаписывает контент, уже отредактированный в админ-панели.
 *
 * Контент сайта — только проверенные публичные факты (см. docs/research-drago.md).
 * Непроверенное создаётся неопубликованным черновиком.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_DESCRIPTIONS,
  ROLE_KEYS,
  ROLE_LEVELS,
  ROLE_NAMES,
  SETTING_DEFAULTS,
  SETTING_KEYS,
} from "@drago/shared";
import { db } from "./index";

loadEnv({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const resetPermissions = process.argv.includes("--reset-permissions");

async function seedRbac() {
  for (const key of PERMISSION_KEYS) {
    await db.permission.upsert({
      where: { key },
      create: { key, description: PERMISSIONS[key] },
      update: { description: PERMISSIONS[key] },
    });
  }
  const permissions = await db.permission.findMany();
  const permId = new Map(permissions.map((p) => [p.key, p.id]));

  for (const key of ROLE_KEYS) {
    const role = await db.role.upsert({
      where: { key },
      create: { key, name: ROLE_NAMES[key], description: ROLE_DESCRIPTIONS[key], level: ROLE_LEVELS[key] },
      update: { name: ROLE_NAMES[key], description: ROLE_DESCRIPTIONS[key], level: ROLE_LEVELS[key] },
      include: { permissions: true },
    });
    // Матрицу прав заполняем только для новой роли (или по флагу --reset-permissions),
    // чтобы не затирать изменения, сделанные SUPERADMIN в админке.
    if (role.permissions.length === 0 || resetPermissions) {
      await db.rolePermission.deleteMany({ where: { roleId: role.id } });
      await db.rolePermission.createMany({
        data: DEFAULT_ROLE_PERMISSIONS[key].map((p) => ({ roleId: role.id, permissionId: permId.get(p)! })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`✓ Роли и права: ${ROLE_KEYS.length} ролей, ${PERMISSION_KEYS.length} прав`);
}

async function seedSettings() {
  for (const key of SETTING_KEYS) {
    await db.setting.upsert({
      where: { key },
      create: { key, value: SETTING_DEFAULTS[key] as object },
      update: {},
    });
  }
  console.log("✓ Настройки по умолчанию");
}

const PAGES: { slug: string; title: string; content: string; isPublished: boolean; seoDescription?: string }[] = [
  {
    slug: "about",
    title: "О нас",
    isPublished: true,
    seoDescription:
      "ТОП «Драго» — трудовой отряд подростков Москвы: первая работа, команда и настоящее трудовое лето для ребят 14–17 лет.",
    content: `**ТОП «Драго»** — трудовой отряд подростков (ТОП) Москвы, часть движения Российских Студенческих Отрядов (РСО).

> Огонь, вода, земля и воздух: вместе эти стихии создают — ТОП «Драго».

Трудовые отряды подростков — это возможность для школьников и несовершеннолетних студентов колледжей получить первый профессиональный опыт. В «Драго» ребята 14–17 лет работают на реальных объектах города, учатся ответственности и становятся командой.

Кроме работы — жизнь отряда: собрания, мероприятия, творческие конкурсы и традиции, которые мы создаём вместе.`,
  },
  {
    slug: "history",
    title: "История Драго",
    isPublished: false,
    content: `_Раздел заполняется командным составом._

Здесь будет история отряда: год основания, первые трудовые проекты, важные события и люди, которые создавали «Драго».`,
  },
  {
    slug: "traditions",
    title: "Традиции и символика",
    isPublished: false,
    content: `_Раздел заполняется командным составом._

Символ отряда — дракон, объединяющий четыре стихии: огонь, воду, землю и воздух. Здесь будут описаны традиции, символика и девиз отряда.`,
  },
  {
    slug: "join",
    title: "Как вступить",
    isPublished: true,
    content: `1. **Оставь заявку** — на этом сайте или в сообщениях сообщества ВКонтакте.
2. **Мы свяжемся с тобой** по контактам из заявки и пригласим на собеседование.
3. **Собеседование** — знакомимся, рассказываем об отряде и работе, отвечаем на вопросы.
4. **Документы** — командный состав подскажет, какие документы и согласия понадобятся.
5. **Добро пожаловать в «Драго»!** Ты получаешь доступ к личному кабинету бойца.`,
  },
  {
    slug: "privacy",
    title: "Политика обработки персональных данных",
    isPublished: true,
    content: `Настоящая политика описывает, какие данные собирает сайт ТОП «Драго» (dragotop.ru) и как они используются.

## Какие данные мы собираем

**Заявка на вступление:** фамилия и имя, возраст, контакт для связи (телефон или email), по желанию — ник Telegram, страница VK, учебное заведение и комментарий. Мы не запрашиваем паспортные данные, адрес и другие сведения, не нужные для рассмотрения заявки.

**Личный кабинет бойца:** ФИО, email, роль в отряде, по желанию — фото и телефон. Контакты бойцов видят только сам боец и командный состав. Публичных списков бойцов нет.

**Технические данные:** IP-адрес и сведения о браузере сохраняются для защиты от взлома (активные сессии, журнал действий администраторов).

## Зачем

Только для рассмотрения заявки, связи с кандидатом, организации работы и жизни отряда. Данные не передаются третьим лицам и не используются для рекламы.

## Сроки хранения

Заявки хранятся не дольше срока, установленного в настройках системы (по умолчанию 1 год), затем удаляются автоматически. Аккаунт бойца удаляется или архивируется по запросу или после выхода из отряда.

## Несовершеннолетние

Сайт рассчитан на подростков 14–17 лет. Отправляя заявку, участник подтверждает, что его родители (законные представители) знают о заявке. Для трудоустройства потребуются согласия, о которых расскажет командный состав.

## Ваши права

Вы можете запросить доступ к своим данным, их исправление или удаление, написав командному составу через контакты на странице «Контакты».

## Cookies

Сайт использует только технически необходимые cookies (вход в личный кабинет). Сторонних счётчиков и рекламных cookies нет.`,
  },
];

async function seedPages() {
  for (const page of PAGES) {
    await db.page.upsert({ where: { slug: page.slug }, create: page, update: {} });
  }
  console.log(`✓ Страницы: ${PAGES.length}`);
}

async function seedTeam() {
  if ((await db.teamMember.count()) > 0) return;
  // Источник: данные владельца проекта; перепроверить актуальность перед публикацией.
  await db.teamMember.createMany({
    data: [
      { fullName: "Алиса Денисова", position: "Командир отряда", sortOrder: 1, isPublished: true },
      { fullName: "Александр Лесников", position: "Комиссар отряда", sortOrder: 2, isPublished: true },
    ],
  });
  console.log("✓ Командный состав");
}

async function seedProjects() {
  if ((await db.project.count()) > 0) return;
  // Источник: публикация МГПУ о трудовом сезоне студенческих отрядов (см. docs/research-drago.md).
  await db.project.createMany({
    data: [
      {
        slug: "detskie-lagerya",
        title: "Детские лагеря",
        summary: "Бойцы работают помощниками вожатых и помогают сделать смену яркой и безопасной.",
        description:
          "Помощники вожатых участвуют в организации отрядной жизни, мероприятий и досуга детей под руководством вожатых и педагогов.",
        period: "Летний трудовой сезон",
        sortOrder: 1,
        isPublished: true,
      },
      {
        slug: "mck-i-mcd",
        title: "МЦК и МЦД",
        summary: "Помощь в организации работы Московского центрального кольца и Московских центральных диаметров.",
        description: "Бойцы отряда помогают в организации работы на объектах МЦК и МЦД.",
        partner: "МЦК, МЦД",
        period: "Летний трудовой сезон",
        sortOrder: 2,
        isPublished: true,
      },
      {
        slug: "moek",
        title: "ПАО «МОЭК»",
        summary: "Работа на объектах Московской объединённой энергетической компании.",
        description: "Участники отряда работают в ПАО «МОЭК» в рамках трудового сезона.",
        partner: "ПАО «МОЭК»",
        period: "Летний трудовой сезон",
        sortOrder: 3,
        isPublished: true,
      },
      {
        slug: "a4-kids-city",
        title: "A4 Kids City",
        summary: "Наставники в детском городе профессий (требует подтверждения командованием).",
        description: "Черновик: уточните у командного состава, участвует ли отряд в этом проекте.",
        sortOrder: 4,
        isPublished: false,
      },
      {
        slug: "vokzaly-rzhd",
        title: "Вокзалы ОАО «РЖД»",
        summary: "Помощники дежурных по вокзалу (требует подтверждения командованием).",
        description: "Черновик: уточните у командного состава, участвует ли отряд в этом проекте.",
        partner: "Дирекция железнодорожных вокзалов ОАО «РЖД»",
        sortOrder: 5,
        isPublished: false,
      },
    ],
  });
  console.log("✓ Проекты");
}

async function seedFaq() {
  if ((await db.faqItem.count()) > 0) return;
  await db.faqItem.createMany({
    data: [
      {
        question: "Кто может вступить в «Драго»?",
        answer: "Ребята 14–17 лет, которые учатся в школе или колледже Москвы.",
        sortOrder: 1,
      },
      {
        question: "Как подать заявку?",
        answer:
          "Заполни короткую анкету на странице [«Вступить»](/join) или напиши в сообщения нашего сообщества ВКонтакте. После этого мы пригласим тебя на собеседование.",
        sortOrder: 2,
      },
      {
        question: "Что такое трудовой отряд подростков?",
        answer:
          "Трудовые отряды подростков (ТОП) — направление Российских Студенческих Отрядов для школьников и несовершеннолетних студентов колледжей. Это возможность получить первый профессиональный опыт в команде.",
        sortOrder: 3,
      },
      {
        question: "Где работают бойцы?",
        answer: "На объектах партнёров отряда — подробнее на странице [«Проекты»](/projects).",
        sortOrder: 4,
      },
      {
        question: "Какие документы понадобятся?",
        answer:
          "Список зависит от возраста и места работы — командный состав расскажет о нём после собеседования. Для младших ребят понадобится письменное согласие родителей.",
        sortOrder: 5,
      },
      {
        question: "Что я получу, кроме работы?",
        answer: "Команду, друзей, мероприятия отряда и РСО, новые навыки и опыт, который пригодится в учёбе и жизни.",
        sortOrder: 6,
      },
    ],
  });
  console.log("✓ FAQ");
}

async function seedDocumentCategories() {
  const cats = [
    { slug: "polozheniya", name: "Положения", minRoleLevel: 20, sortOrder: 1 },
    { slug: "instrukcii", name: "Инструкции", minRoleLevel: 20, sortOrder: 2 },
    { slug: "raspisaniya", name: "Расписания", minRoleLevel: 20, sortOrder: 3 },
    { slug: "metodichki", name: "Методички", minRoleLevel: 20, sortOrder: 4 },
    { slug: "dokumenty-otryada", name: "Документы отряда", minRoleLevel: 20, sortOrder: 5 },
    { slug: "dlya-kandidatov", name: "Для кандидатов", minRoleLevel: 10, sortOrder: 6 },
    { slug: "komandnyy-sostav", name: "Командный состав", minRoleLevel: 40, sortOrder: 7 },
  ];
  for (const c of cats) await db.documentCategory.upsert({ where: { slug: c.slug }, create: c, update: {} });
  console.log("✓ Категории документов");
}

async function main() {
  await seedRbac();
  await seedSettings();
  await seedPages();
  await seedTeam();
  await seedProjects();
  await seedFaq();
  await seedDocumentCategories();
  console.log("\nГотово. Создайте первого администратора: pnpm admin:invite --email you@example.com");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
