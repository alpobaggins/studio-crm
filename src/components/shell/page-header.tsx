import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

/** Заголовок страницы: крупный h1, подзаголовок серым, действия-капсулы справа, ссылка назад к списку. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8 flex flex-col gap-5 sm:mb-10 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-3 inline-flex items-center gap-1.5 rounded-sm text-small font-medium text-ink-secondary hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            {back.label}
          </Link>
        )}
        <h1 className="text-title-1 break-words">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-lead text-ink-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:shrink-0 md:flex-nowrap">{actions}</div>}
    </header>
  );
}
