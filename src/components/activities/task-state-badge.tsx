import { Check, Clock, type LucideIcon } from "lucide-react";
import type { TaskState } from "@/lib/activities";
import { Badge } from "@/components/ui/badge";

// Вид бейджей задачи — DESIGN.md, «Бейджи и статусы»: только серые оттенки и обязательная подпись.
const LOOK: Record<TaskState, { variant: "inverse" | "control" | "ghost"; icon?: LucideIcon; label: string }> = {
  overdue: { variant: "inverse", icon: Clock, label: "Просрочено" },
  today: { variant: "control", icon: Clock, label: "Сегодня" },
  planned: { variant: "ghost", label: "Запланирована" },
  done: { variant: "ghost", icon: Check, label: "Выполнена" },
};

export function TaskStateBadge({ state }: { state: TaskState }) {
  const { variant, icon, label } = LOOK[state];
  return (
    <Badge variant={variant} icon={icon}>
      {state === "today" ? <span className="font-medium">{label}</span> : label}
    </Badge>
  );
}
