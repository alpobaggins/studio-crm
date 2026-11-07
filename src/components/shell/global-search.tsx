"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SearchField } from "@/components/ui/filters";

const LABEL = "Поиск по CRM";
const PLACEHOLDER = "Поиск по CRM";

/** На странице результатов поле показывает текущий запрос; на остальных страницах оно пустое. */
function CurrentQuerySearch() {
  const pathname = usePathname();
  const q = useSearchParams().get("q");
  return <SearchField action="/search" label={LABEL} placeholder={PLACEHOLDER} defaultValue={pathname === "/search" ? (q ?? undefined) : undefined} />;
}

/**
 * Глобальный поиск в оболочке (DESIGN.md 4, Plan.md шаг 09): обычная GET-форма на `/search?q=`.
 * Адрес известен только при запросе, поэтому подстановка запроса стоит внутри <Suspense>.
 */
export function GlobalSearch() {
  return (
    <Suspense fallback={<SearchField action="/search" label={LABEL} placeholder={PLACEHOLDER} />}>
      <CurrentQuerySearch />
    </Suspense>
  );
}
