import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";

export type FilterOption = { label: string; href: string; active: boolean };

/**
 * Вкладки-ссылки: активная подчёркнута линией 2 px (DESIGN.md, «Панель фильтров»).
 * Состояние хранится в URL, поэтому вкладки работают без JavaScript и переживают перезагрузку.
 * На узком экране вкладки переносятся на новую строку: горизонтальная прокрутка допустима только в Kanban.
 */
export function FilterTabs({ label, options }: { label: string; options: FilterOption[] }) {
  return (
    <nav aria-label={label} className="border-b border-line">
      <ul className="-mb-px flex flex-wrap gap-x-5">
        {options.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              aria-current={option.active ? "true" : undefined}
              className={
                "inline-flex h-11 items-center whitespace-nowrap border-b-2 text-body transition-colors " +
                (option.active
                  ? "border-ink font-semibold text-ink"
                  : "border-transparent font-medium text-ink-secondary hover:text-ink")
              }
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Группа фильтра: подпись `caption` серым и значения чипами 32 px; выбранный чип — чёрный. */
export function FilterChips({ label, options }: { label: string; options: FilterOption[] }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span aria-hidden="true" className="text-caption text-ink-secondary">
        {label}
      </span>
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              aria-current={option.active ? "true" : undefined}
              className={
                "inline-flex h-8 items-center whitespace-nowrap rounded-full px-3.5 text-small font-medium transition-colors " +
                (option.active ? "bg-inverse text-ink-inverse" : "bg-control text-ink hover:bg-control-hover")
              }
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Поиск-пилюля. Обычная GET-форма: запрос попадает в URL (`?q=`), остальные фильтры
 * передаются скрытыми полями. `next/form` выполняет переход без перезагрузки страницы.
 */
export function SearchField({
  action,
  label,
  placeholder,
  defaultValue,
  hidden = {},
}: {
  action: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <Form action={action} role="search" className="w-full sm:max-w-sm">
      {Object.entries(hidden).map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-secondary" />
        <input
          // key сбрасывает поле, когда запрос меняется не через него (например, «Сбросить фильтры»).
          key={defaultValue ?? ""}
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          maxLength={200}
          className="h-10 w-full rounded-full bg-control pl-11 pr-4 text-body text-ink placeholder:text-ink-secondary"
        />
      </label>
    </Form>
  );
}
