import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  Images,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Mail,
  Megaphone,
  Newspaper,
  PanelsTopLeft,
  Plug,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import { db } from "@drago/database";
import { fullName, type PermissionKey } from "@drago/shared";
import { AppShell, type NavGroup, type NavItem } from "@/components/ui/shell";
import { UserMenu } from "@/components/cabinet/user-menu";
import { requireAdmin } from "@/lib/auth/current-user";
import { fileUrl } from "@/lib/uploads";

export const metadata: Metadata = { title: { default: "Админ-панель", template: "%s — админ-панель «Драго»" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const newApplications = user.can("applications.read") ? await db.joinApplication.count({ where: { status: "NEW" } }) : 0;

  const item = (perm: PermissionKey | null, it: NavItem): NavItem[] => (perm === null || user.can(perm) ? [it] : []);
  const groups: NavGroup[] = [
    { items: [{ href: "/admin/dashboard", label: "Обзор", icon: <LayoutDashboard /> }] },
    {
      title: "Люди",
      items: [
        ...item("users.read", { href: "/admin/users", label: "Пользователи", icon: <Users /> }),
        ...item("applications.read", { href: "/admin/applications", label: "Заявки", icon: <Inbox />, badge: newApplications }),
      ],
    },
    {
      title: "Жизнь отряда",
      items: [
        ...item("announcements.manage", { href: "/admin/announcements", label: "Объявления", icon: <Megaphone /> }),
        ...item("events.manage", { href: "/admin/events", label: "Мероприятия", icon: <CalendarDays /> }),
        ...item("tasks.manage", { href: "/admin/tasks", label: "Задачи", icon: <ListTodo /> }),
        ...item("documents.manage", { href: "/admin/documents", label: "Документы", icon: <FileText /> }),
      ],
    },
    {
      title: "Сайт",
      items: [
        ...item("news.manage", { href: "/admin/news", label: "Новости", icon: <Newspaper /> }),
        ...item("gallery.manage", { href: "/admin/gallery", label: "Галерея", icon: <Images /> }),
        ...item("pages.manage", { href: "/admin/pages", label: "Страницы и контент", icon: <PanelsTopLeft /> }),
      ],
    },
    {
      title: "Система",
      items: [
        ...item("mail.manage", { href: "/admin/mail", label: "Почта", icon: <Mail /> }),
        ...item("integrations.manage", { href: "/admin/integrations", label: "Интеграции", icon: <Plug /> }),
        ...item("audit.read", { href: "/admin/audit", label: "Журнал аудита", icon: <ScrollText /> }),
        ...item("settings.manage", { href: "/admin/settings", label: "Настройки", icon: <Settings /> }),
      ],
    },
    { title: "Кабинет", items: [{ href: "/cabinet/dashboard", label: "Мой кабинет", icon: <ClipboardList /> }] },
  ].filter((g) => g.items.length > 0);

  const name = user.profile ? fullName(user.profile) : user.email;
  return (
    <AppShell
      groups={groups}
      title="Админ-панель"
      user={<UserMenu name={name} roleName={user.role.name} avatarUrl={user.profile?.avatarFileId ? fileUrl(user.profile.avatarFileId) : null} />}
    >
      {children}
    </AppShell>
  );
}
