import type { LeadStatus } from "@prisma/client";
import { ArrowRight, Check, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_LABELS } from "@/lib/leads";

// Вид бейджей статусов лида — DESIGN.md, «Бейджи и статусы».
const LOOK: Record<LeadStatus, { variant: "outline" | "control" | "ghost" | "inverse"; icon?: LucideIcon }> = {
  new: { variant: "outline" },
  in_progress: { variant: "control" },
  qualified: { variant: "control", icon: Check },
  disqualified: { variant: "ghost", icon: X },
  converted: { variant: "inverse", icon: ArrowRight },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const { variant, icon } = LOOK[status];
  return (
    <Badge variant={variant} icon={icon}>
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}
