import type { StageType } from "@prisma/client";
import { Trophy, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DEAL_STATUS_LABELS } from "@/lib/deals";

// Вид бейджей статуса сделки — DESIGN.md, «Бейджи и статусы». Статус — это тип стадии (Plan.md 1.4).
const LOOK: Record<StageType, { variant: "control" | "inverse" | "outlineMuted"; icon?: LucideIcon }> = {
  open: { variant: "control" },
  won: { variant: "inverse", icon: Trophy },
  lost: { variant: "outlineMuted", icon: X },
};

export function DealStatusBadge({ type }: { type: StageType }) {
  const { variant, icon } = LOOK[type];
  return (
    <Badge variant={variant} icon={icon}>
      {DEAL_STATUS_LABELS[type]}
    </Badge>
  );
}
