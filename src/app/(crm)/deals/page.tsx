import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Handshake, Plus, SearchX } from "lucide-react";
import { DealStatusBadge } from "@/components/deals/deal-status-badge";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/ui/block";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips, FilterTabs, SearchField } from "@/components/ui/filters";
import { ListSkeleton } from "@/components/ui/skeleton";
import { DEAL_STATUS_LABELS, STAGE_TYPES } from "@/lib/deals";
import { formatMoney, formatShortDateInZone, pluralRu } from "@/lib/format";
import { listDeals, listStages } from "@/server/queries/deals";
import { parseDealFilters, type DealFilters } from "@/server/validation/deal";

export const metadata: Metadata = { title: "Сделки" };

const createButton = (
  <Link href="/deals/new" className={buttonClasses("primary")}>
    <Plus aria-hidden="true" size={18} />
    Создать сделку
  </Link>
);

/** Адрес списка с фильтрами; пустые значения в URL не попадают. */
function dealsHref(filters: DealFilters): string {
  const params = new URLSearchParams();
  for (const key of ["q", "status", "stage"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/deals?${query}` : "/deals";
}

export default function DealsPage({ searchParams }: PageProps<"/deals">) {
  return (
    <>
      <PageHeader title="Сделки" description="Все сделки агентства: открытые, выигранные и проигранные." actions={createButton} />
      <Suspense fallback={<ListSkeleton />}>
        <DealsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DealsContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parsed = parseDealFilters(await searchParams);
  const stages = await listStages();
  // Неизвестная стадия в адресе игнорируется, как и другие неизвестные значения фильтров.
  const filters = { ...parsed, stage: stages.some((s) => s.id === parsed.stage) ? parsed.stage : undefined };
  const deals = await listDeals(filters);
  const hasFilters = Boolean(filters.q || filters.status || filters.stage);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchField
            action="/deals"
            label="Поиск по сделкам"
            placeholder="Название, компания или контакт"
            defaultValue={filters.q}
            hidden={{ status: filters.status, stage: filters.stage }}
          />
          {hasFilters && (
            <Link href="/deals" className="self-start rounded-sm text-body font-medium text-accent hover:text-accent-hover hover:underline hover:underline-offset-4 sm:self-auto">
              Сбросить фильтры
            </Link>
          )}
        </div>
        {/* Статус и стадия — независимые фильтры (Plan.md 1.4): несовместимое сочетание даёт пустой список. */}
        <FilterTabs
          label="Статус"
          options={[
            { label: "Все", href: dealsHref({ ...filters, status: undefined }), active: !filters.status },
            ...STAGE_TYPES.map((status) => ({
              label: DEAL_STATUS_LABELS[status],
              href: dealsHref({ ...filters, status }),
              active: filters.status === status,
            })),
          ]}
        />
        <FilterChips
          label="Стадия"
          options={[
            { label: "Все", href: dealsHref({ ...filters, stage: undefined }), active: !filters.stage },
            ...stages.map((stage) => ({
              label: stage.name,
              href: dealsHref({ ...filters, stage: stage.id }),
              active: filters.stage === stage.id,
            })),
          ]}
        />
      </div>

      {deals.length === 0 ? (
        <Block>
          {hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="По этим фильтрам ничего нет"
              description="Измените условия поиска или сбросьте фильтры."
              action={
                <Link href="/deals" className={buttonClasses("secondary")}>
                  Сбросить фильтры
                </Link>
              }
              className="min-h-80"
            />
          ) : (
            <EmptyState
              icon={Handshake}
              title="Сделок пока нет"
              description="Создайте первую сделку: укажите компанию, а сумму и контакт можно добавить позже."
              action={createButton}
              className="min-h-80"
            />
          )}
        </Block>
      ) : (
        <DealsTable deals={deals} />
      )}
    </div>
  );
}

function DealsTable({ deals }: { deals: Awaited<ReturnType<typeof listDeals>> }) {
  return (
    <div>
      <p className="mb-3 text-small text-ink-secondary" aria-live="polite">
        {pluralRu(deals.length, ["сделка", "сделки", "сделок"])}
      </p>

      {/* С 768 px — таблица, уже — карточки-строки (DESIGN.md, «Таблица», «Адаптивность»). */}
      <table className="hidden w-full text-left md:table">
        <thead>
          <tr className="border-b border-line text-caption text-ink-secondary">
            <th scope="col" className="py-3 pr-4 font-medium">Сделка</th>
            <th scope="col" className="py-3 pr-4 font-medium">Компания</th>
            <th scope="col" className="py-3 pr-4 font-medium">Стадия</th>
            <th scope="col" className="py-3 pr-4 font-medium">Статус</th>
            <th scope="col" className="py-3 text-right font-medium xl:pr-4">Сумма</th>
            <th scope="col" className="hidden py-3 text-right font-medium xl:table-cell">Мероприятие</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id} className="border-b border-line transition-colors hover:bg-subtle">
              <td className="py-4 pr-4">
                <Link href={`/deals/${deal.id}`} className="rounded-sm font-semibold hover:text-accent">
                  {deal.name}
                </Link>
                <p className="max-w-64 truncate text-small text-ink-secondary">{deal.contact?.fullName ?? "Без контакта"}</p>
              </td>
              <td className="py-4 pr-4 text-ink-secondary">
                <span className="line-clamp-2">{deal.account.name}</span>
              </td>
              <td className="py-4 pr-4 text-ink-secondary">{deal.stage.name}</td>
              <td className="py-4 pr-4">
                <DealStatusBadge type={deal.stage.type} />
              </td>
              <td className="whitespace-nowrap py-4 text-right tabular-nums xl:pr-4">{deal.amount ? formatMoney(deal.amount) : "—"}</td>
              <td className="hidden whitespace-nowrap py-4 text-right tabular-nums text-ink-secondary xl:table-cell">
                {deal.eventDate ? formatShortDateInZone(deal.eventDate, "UTC") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line border-y border-line md:hidden">
        {deals.map((deal) => (
          <li key={deal.id}>
            <Link href={`/deals/${deal.id}`} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{deal.name}</p>
                <p className="truncate text-small text-ink-secondary">{[deal.account.name, deal.stage.name].join(" · ")}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <DealStatusBadge type={deal.stage.type} />
                  <span className="text-small tabular-nums">{deal.amount ? formatMoney(deal.amount) : "Сумма не указана"}</span>
                </div>
              </div>
              <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-ink-secondary" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
