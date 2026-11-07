import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Inbox, Plus, SearchX } from "lucide-react";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/ui/block";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips, FilterTabs, SearchField } from "@/components/ui/filters";
import { ListSkeleton } from "@/components/ui/skeleton";
import { getAppTimeZone } from "@/lib/dates";
import { formatMoney, formatShortDateInZone, pluralRu } from "@/lib/format";
import { LEAD_SOURCE_LABELS, LEAD_SOURCES, LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/leads";
import { listLeads } from "@/server/queries/leads";
import { parseLeadFilters, type LeadFilters } from "@/server/validation/lead";

export const metadata: Metadata = { title: "Лиды" };

const createButton = (
  <Link href="/leads/new" className={buttonClasses("primary")}>
    <Plus aria-hidden="true" size={18} />
    Создать лид
  </Link>
);

/** Адрес списка с фильтрами; пустые значения в URL не попадают. */
function leadsHref(filters: LeadFilters): string {
  const params = new URLSearchParams();
  for (const key of ["q", "status", "source"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/leads?${query}` : "/leads";
}

export default function LeadsPage({ searchParams }: PageProps<"/leads">) {
  return (
    <>
      <PageHeader title="Лиды" description="Входящие запросы с сайта, почты, телефона, по рекомендациям и вручную." actions={createButton} />
      <Suspense fallback={<ListSkeleton />}>
        <LeadsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LeadsContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseLeadFilters(await searchParams);
  const leads = await listLeads(filters);
  const hasFilters = Boolean(filters.q || filters.status || filters.source);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchField
            action="/leads"
            label="Поиск по лидам"
            placeholder="Имя, компания, email или телефон"
            defaultValue={filters.q}
            hidden={{ status: filters.status, source: filters.source }}
          />
          {hasFilters && (
            <Link href="/leads" className="self-start rounded-sm text-body font-medium text-accent hover:text-accent-hover hover:underline hover:underline-offset-4 sm:self-auto">
              Сбросить фильтры
            </Link>
          )}
        </div>
        <FilterTabs
          label="Статус"
          options={[
            { label: "Все", href: leadsHref({ ...filters, status: undefined }), active: !filters.status },
            ...LEAD_STATUSES.map((status) => ({
              label: LEAD_STATUS_LABELS[status],
              href: leadsHref({ ...filters, status }),
              active: filters.status === status,
            })),
          ]}
        />
        <FilterChips
          label="Источник"
          options={[
            { label: "Все", href: leadsHref({ ...filters, source: undefined }), active: !filters.source },
            ...LEAD_SOURCES.map((source) => ({
              label: LEAD_SOURCE_LABELS[source],
              href: leadsHref({ ...filters, source }),
              active: filters.source === source,
            })),
          ]}
        />
      </div>

      {leads.length === 0 ? (
        <Block>
          {hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="По этим фильтрам ничего нет"
              description="Измените условия поиска или сбросьте фильтры."
              action={
                <Link href="/leads" className={buttonClasses("secondary")}>
                  Сбросить фильтры
                </Link>
              }
              className="min-h-80"
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="Лидов пока нет"
              description="Создайте первый лид — входящий запрос клиента."
              action={createButton}
              className="min-h-80"
            />
          )}
        </Block>
      ) : (
        <LeadsTable leads={leads} />
      )}
    </div>
  );
}

function LeadsTable({ leads }: { leads: Awaited<ReturnType<typeof listLeads>> }) {
  const timeZone = getAppTimeZone();
  return (
    <div>
      <p className="mb-3 text-small text-ink-secondary" aria-live="polite">
        {pluralRu(leads.length, ["лид", "лида", "лидов"])}
      </p>

      {/* С 768 px — таблица, уже — карточки-строки (DESIGN.md, «Таблица», «Адаптивность»). */}
      <table className="hidden w-full text-left md:table">
        <thead>
          <tr className="border-b border-line text-caption text-ink-secondary">
            <th scope="col" className="py-3 pr-4 font-medium">Контакт</th>
            <th scope="col" className="py-3 pr-4 font-medium">Компания</th>
            <th scope="col" className="hidden py-3 pr-4 font-medium lg:table-cell">Источник</th>
            <th scope="col" className="py-3 pr-4 font-medium">Статус</th>
            <th scope="col" className="py-3 text-right font-medium xl:pr-4">Бюджет</th>
            <th scope="col" className="hidden py-3 text-right font-medium xl:table-cell">Создан</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-line transition-colors hover:bg-subtle">
              <td className="py-4 pr-4">
                <Link href={`/leads/${lead.id}`} className="rounded-sm font-semibold hover:text-accent">
                  {lead.contactName}
                </Link>
                <p className="max-w-56 truncate text-small text-ink-secondary">{lead.email ?? lead.phone}</p>
              </td>
              <td className="py-4 pr-4 text-ink-secondary">{lead.companyName ?? "—"}</td>
              <td className="hidden py-4 pr-4 text-ink-secondary lg:table-cell">{LEAD_SOURCE_LABELS[lead.source]}</td>
              <td className="py-4 pr-4">
                <LeadStatusBadge status={lead.status} />
              </td>
              <td className="whitespace-nowrap py-4 text-right tabular-nums xl:pr-4">{lead.budget ? formatMoney(lead.budget) : "—"}</td>
              <td className="hidden whitespace-nowrap py-4 text-right tabular-nums text-ink-secondary xl:table-cell">
                {formatShortDateInZone(lead.createdAt, timeZone)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line border-y border-line md:hidden">
        {leads.map((lead) => (
          <li key={lead.id}>
            <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{lead.contactName}</p>
                <p className="truncate text-small text-ink-secondary">
                  {[lead.companyName ?? "Компания не указана", LEAD_SOURCE_LABELS[lead.source]].join(" · ")}
                </p>
                <div className="mt-1.5">
                  <LeadStatusBadge status={lead.status} />
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
