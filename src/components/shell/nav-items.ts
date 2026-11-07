import { Building2, Handshake, Inbox, LayoutDashboard, SquareKanban, Users } from "lucide-react";

/** Пункты боковой навигации в порядке DESIGN.md. */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/leads", label: "Лиды", icon: Inbox },
  { href: "/pipeline", label: "Воронка", icon: SquareKanban },
  { href: "/deals", label: "Сделки", icon: Handshake },
  { href: "/accounts", label: "Компании", icon: Building2 },
  { href: "/contacts", label: "Контакты", icon: Users },
] as const;
