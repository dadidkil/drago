import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  CalendarRange,
  CircleHelp,
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
import { fullName } from "@drago/shared";
import { AppShell, type NavGroup } from "@/components/ui/shell";
import { UserMenu } from "@/components/cabinet/user-menu";
import { requireUser } from "@/lib/auth/current-user";
import { fileUrl } from "@/lib/uploads";

export const metadata: Metadata = { title: { default: "Личный кабинет", template: "%s — кабинет «Драго»" }, robots: { index: false } };

export default async function CabinetLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/cabinet");
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });

  const groups: NavGroup[] = [
    {
      items: [
        { href: "/cabinet/dashboard", label: "Главная", icon: <LayoutDashboard /> },
        { href: "/cabinet/notifications", label: "Уведомления", icon: <Bell />, badge: unread },
        { href: "/cabinet/announcements", label: "Объявления", icon: <Megaphone /> },
        { href: "/cabinet/tasks", label: "Задачи", icon: <ListTodo /> },
        { href: "/cabinet/events", label: "Мероприятия", icon: <CalendarDays /> },
        { href: "/cabinet/calendar", label: "Календарь", icon: <CalendarRange /> },
        { href: "/cabinet/documents", label: "Документы", icon: <FileText /> },
        { href: "/cabinet/team", label: "Отряд", icon: <Users /> },
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
      {children}
    </AppShell>
  );
}
