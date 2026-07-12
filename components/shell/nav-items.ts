import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  History,
  Moon,
  Table2,
  Trophy,
  User,
  ShoppingBag,
  Gamepad2,
  GraduationCap,
  BookOpen,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { useAuth } from "@/components/auth-provider";
import { isAnyAdmin, isStaff } from "@/lib/roles";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  admin?: boolean;
  creator?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Дашборд", short: "Главная", icon: LayoutDashboard },
  { href: "/reports", label: "Отчёты", short: "Отчёт", icon: FileText },
  { href: "/review", label: "Руководство", short: "Рук-во", icon: ClipboardCheck, admin: true },
  { href: "/actions", label: "Действия", short: "Действия", icon: History, admin: true },
  { href: "/inactives", label: "Неактивы", short: "Неактив", icon: Moon },
  { href: "/table", label: "Таблица", short: "Таблица", icon: Table2 },
  { href: "/leaderboard", label: "Лидеры", short: "Лидеры", icon: Trophy },
  { href: "/shop", label: "Магазин", short: "Шоп", icon: ShoppingBag },
  { href: "/games", label: "Игры", short: "Игры", icon: Gamepad2 },
  { href: "/training", label: "Обучение", short: "Учёба", icon: GraduationCap },
  { href: "/help", label: "Гайд", short: "Гайд", icon: BookOpen },
  { href: "/profile", label: "Профиль", short: "Профиль", icon: User },
  { href: "/admin", label: "Админ", short: "Админ", icon: ShieldCheck, admin: true },
];

/** Пункты нижнего таб-бара — самое важное для телефона (остальное в «Ещё») */
export const TAB_HREFS = ["/", "/reports", "/review", "/table", "/profile"];

export function visibleItems(roles: ReturnType<typeof useAuth>["roles"], items: NavItem[]) {
  // Без статуса модератора (до выдачи прав руководством) виден только профиль
  if (!isStaff(roles)) return items.filter((i) => i.href === "/profile");
  return items.filter((i) => !i.admin || isAnyAdmin(roles));
}
