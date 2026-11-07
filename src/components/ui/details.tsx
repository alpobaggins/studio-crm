import type { ReactNode } from "react";

/** Поля записи в карточке: подпись слева, значение справа; пустое значение — «Не указано». */
export function Details({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map(({ label, value }) => (
        <div key={label} className="grid gap-1 py-3 sm:grid-cols-[176px_1fr] sm:gap-4">
          <dt className="text-small text-ink-secondary sm:pt-0.5">{label}</dt>
          <dd className="min-w-0 break-words text-body">
            {value ?? <span className="text-ink-secondary">Не указано</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Ссылка внутри значения поля: email, телефон, сайт, связанная запись. */
export const valueLinkClasses =
  "rounded-sm font-medium text-accent hover:text-accent-hover hover:underline hover:underline-offset-4";
