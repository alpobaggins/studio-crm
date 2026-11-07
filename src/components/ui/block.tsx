import type { ReactNode } from "react";

/**
 * Серый скруглённый блок для крупного содержимого: аналитика, пустые разделы.
 * Внутри обычно лежит белое поле — приём из референсов «белое на сером».
 */
export function Block({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col rounded-xl bg-block p-2 ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 px-4 pb-3 pt-4 sm:px-5">
          {title && <h2 className="text-title-2">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
