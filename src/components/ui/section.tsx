import type { ReactNode } from "react";

/** Лёгкая секция без подложки: заголовок и тонкая линия. Для списков и сводок. */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <header className="flex items-center justify-between gap-4 border-b border-line pb-3">
        <h2 className="text-title-2">{title}</h2>
        {action}
      </header>
      <div className="pt-4">{children}</div>
    </section>
  );
}
