import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  BookOpen,
  Bell,
  CalendarDays,
  CalendarRange,
  CircleHelp,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  ListTodo,
  Mail,
  Megaphone,
  Shield,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { db } from "@drago/database";
import { blockingSurvey, surveysForUser } from "@drago/core";
import { formatDateTime, fullName } from "@drago/shared";
import { AppShell, type NavGroup } from "@/components/ui/shell";
import { SurveyGate, type PendingSurvey } from "@/components/cabinet/survey-gate";
import { UserMenu } from "@/components/cabinet/user-menu";
import { requireUser } from "@/lib/auth/current-user";
import { fileUrl } from "@/lib/uploads";

export const metadata: Metadata = { title: { default: "Личный кабинет", template: "%s — кабинет «Драго»" }, robots: { index: false } };

export default async function CabinetLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/cabinet");
  const [unread, surveys] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    surveysForUser({ id: user.id, roleLevel: user.level }),
  ]);
  const toPending = (s: (typeof surveys)[number]): PendingSurvey => ({
    id: s.survey.id,
    title: s.survey.title,
    due: formatDateTime(s.period.dueAt),
    overdue: s.status === "overdue",
  });
  const open = surveys.filter((s) => s.status !== "done");
  // Баннер — для форм с режимом «баннер» или «блокировка»; «только напоминания» — лишь счётчик в меню.
  const banner = open.filter((s) => s.survey.enforcement !== "REMIND").map(toPending);
  const block = blockingSurvey(surveys);

  const groups: NavGroup[] = [
    {
      items: [
        { href: "/cabinet/dashboard", label: "Главная", icon: <LayoutDashboard /> },
        { href: "/cabinet/notifications", label: "Уведомления", icon: <Bell />, badge: unread },
        { href: "/cabinet/announcements", label: "Объявления", icon: <Megaphone /> },
        { href: "/cabinet/tasks", label: "Задачи", icon: <ListTodo /> },
        { href: "/cabinet/surveys", label: "Формы", icon: <ClipboardCheck />, badge: open.length },
        { href: "/cabinet/events", label: "Мероприятия", icon: <CalendarDays /> },
        { href: "/cabinet/calendar", label: "Календарь", icon: <CalendarRange /> },
        { href: "/cabinet/documents", label: "Документы", icon: <FileText /> },
        { href: "/cabinet/team", label: "Отряд", icon: <Users /> },
        { href: "/cabinet/knowledge", label: "База знаний", icon: <BookOpen /> },
      ],
    },
    {
      title: "Аккаунт",
      items: [
        { href: "/cabinet/profile", label: "Профиль", icon: <User /> },
        { href: "/cabinet/mail", label: "Почта @dragotop.ru", icon: <Mail /> },
        { href: "/cabinet/security", label: "Безопасность", icon: <Shield /> },
        { href: "/cabinet/help", label: "Помощь", icon: <CircleHelp /> },
      ],
    },
  ];
  if (user.can("admin.access")) {
    groups.push({ title: "Управление", items: [{ href: "/admin/dashboard", label: "Админ-панель", icon: <ShieldCheck /> }] });
  }

  const name = user.profile ? fullName(user.profile) : user.email;
  return (
    <AppShell
      groups={groups}
      title="Личный кабинет"
      user={<UserMenu name={name} roleName={user.role.name} avatarUrl={user.profile?.avatarFileId ? fileUrl(user.profile.avatarFileId) : null} />}
    >
      <SurveyGate pending={banner} blocked={block ? toPending(block) : null}>
        {children}
      </SurveyGate>
    </AppShell>
  );
}
