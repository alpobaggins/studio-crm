import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Variant = "outline" | "control" | "ghost" | "inverse";

// Только оттенки серого и обязательная подпись: цвет не единственный сигнал (DESIGN.md, «Бейджи и статусы»).
const variants: Record<Variant, string> = {
  outline: "border border-line-control bg-card text-ink",
  control: "bg-control text-ink",
  ghost: "text-ink-secondary",
  inverse: "bg-inverse text-ink-inverse",
};

export function Badge({ variant, icon: Icon, children }: { variant: Variant; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-small ${variants[variant]}`}
    >
      {Icon && <Icon aria-hidden="true" size={13} strokeWidth={2.25} />}
      {children}
    </span>
  );
}
