import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Пустое состояние на белом поле: иконка раздела, короткое объяснение, не больше одного действия. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-lg bg-card px-6 py-12 text-center ${className}`}
    >
      {Icon && (
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-block">
          <Icon aria-hidden="true" size={22} strokeWidth={1.75} />
        </span>
      )}
      <p className="text-title-3">{title}</p>
      {description && <p className="max-w-sm text-body text-ink-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
