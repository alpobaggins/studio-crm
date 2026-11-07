import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Search, SearchX } from "lucide-react";
import { DealStatusBadge } from "@/components/deals/deal-status-badge";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/ui/block";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";
import { pluralRu } from "@/lib/format";
import { SEARCH_LIMIT, searchCrm } from "@/server/queries/search";

export const metadata: Metadata = { title: "Поиск" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <>
      <PageHeader title="Поиск" description="Лиды, компании, контакты и сделки по имени, названию, компании, email и телефону." />
      <Suspense fallback={<ListSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SearchResults({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 200) ?? "";

  if (!q) {
    return (
      <Block>
        <EmptyState icon={Search} title="Введите запрос" description="Воспользуйтесь полем поиска вверху страницы." className="min-h-80" />
      </Block>
    );
  }

  const { leads, accounts, contacts, deals } = await searchCrm(q);
  const total = leads.items.length + accounts.items.length + contacts.items.length + deals.items.length;
  if (total === 0) {
    return (
      <Block>
        <EmptyState icon={SearchX} title="Ничего не найдено" description={`По запросу «${q}» записей нет. Проверьте написание или сократите запрос.`} className="min-h-80" />
      </Block>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-small text-ink-secondary" aria-live="polite">
        По запросу «{q}» найдено: {pluralRu(total, ["запись", "записи", "записей"])}
      </p>
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 xl:grid-cols-2">
        {/* Пустые группы не показываются: так результаты читаются быстрее. */}
        {leads.items.length > 0 && (
          <Group title="Лиды" count={leads.items.length} hasMore={leads.hasMore}>
            {leads.items.map((lead) => (
              <Row key={lead.id} href={`/leads/${lead.id}`} title={lead.contactName} meta={lead.companyName ?? "Компания не указана"} badge={<LeadStatusBadge status={lead.status} />} />
            ))}
          </Group>
        )}
        {accounts.items.length > 0 && (
          <Group title="Компании" count={accounts.items.length} hasMore={accounts.hasMore}>
            {accounts.items.map((account) => (
              <Row key={account.id} href={`/accounts/${account.id}`} title={account.name} meta={[account.industry, account.city].filter(Boolean).join(" · ") || "Отрасль и город не указаны"} />
            ))}
          </Group>
        )}
        {contacts.items.length > 0 && (
          <Group title="Контакты" count={contacts.items.length} hasMore={contacts.hasMore}>
            {contacts.items.map((contact) => (
              <Row key={contact.id} href={`/contacts/${contact.id}`} title={contact.fullName} meta={[contact.position, contact.account?.name ?? "Без компании"].filter(Boolean).join(" · ")} />
            ))}
          </Group>
        )}
        {deals.items.length > 0 && (
          <Group title="Сделки" count={deals.items.length} hasMore={deals.hasMore}>
            {deals.items.map((deal) => (
              <Row key={deal.id} href={`/deals/${deal.id}`} title={deal.name} meta={[deal.account.name, deal.stage.name].join(" · ")} badge={<DealStatusBadge type={deal.stage.type} />} />
            ))}
          </Group>
        )}
      </div>
    </div>
  );
}

function Group({ title, count, hasMore, children }: { title: string; count: number; hasMore: boolean; children: ReactNode }) {
  return (
    <Section title={`${title} · ${hasMore ? `${count}+` : count}`}>
      <ul className="divide-y divide-line">{children}</ul>
      {hasMore && (
        <p className="pt-3 text-small text-ink-secondary">Показаны первые {SEARCH_LIMIT}. Уточните запрос, чтобы увидеть остальные.</p>
      )}
    </Section>
  );
}

function Row({ href, title, meta, badge }: { href: string; title: string; meta: string; badge?: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <Link href={href} className="rounded-sm font-semibold hover:text-accent">
          {title}
        </Link>
        <p className="truncate text-small text-ink-secondary">{meta}</p>
      </div>
      {badge}
    </li>
  );
}
