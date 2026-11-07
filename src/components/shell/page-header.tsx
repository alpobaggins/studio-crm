import type { ReactNode } from "react";

/** Заголовок страницы: крупный h1, подзаголовок серым, действия-капсулы справа. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-5 sm:mb-10 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-title-1 break-words">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-lead text-ink-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:shrink-0 md:flex-nowrap">{actions}</div>}
    </header>
  );
}
