import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/ui/block";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { pluralRu } from "@/lib/format";
import { listAccounts } from "@/server/queries/accounts";

export const metadata: Metadata = { title: "Компании" };

const createButton = (
  <Link href="/accounts/new" className={buttonClasses("primary")}>
    <Plus aria-hidden="true" size={18} />
    Создать компанию
  </Link>
);

export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Компании" description="Клиенты агентства, их контакты и сделки." actions={createButton} />
      <Suspense fallback={<ListSkeleton />}>
        <AccountsList />
      </Suspense>
    </>
  );
}

async function AccountsList() {
  const accounts = await listAccounts();

  if (accounts.length === 0) {
    return (
      <Block>
        <EmptyState
          icon={Building2}
          title="Компаний пока нет"
          description="Добавьте первого клиента агентства — к нему можно будет привязать контакты и сделки."
          action={createButton}
          className="min-h-80"
        />
      </Block>
    );
  }

  return (
    <>
      <p className="mb-3 text-small text-ink-secondary">
        {pluralRu(accounts.length, ["компания", "компании", "компаний"])}
      </p>

      {/* С 768 px — таблица, уже — карточки-строки (DESIGN.md, «Таблица», «Адаптивность»). */}
      <table className="hidden w-full text-left md:table">
        <thead>
          <tr className="border-b border-line text-caption text-ink-secondary">
            <th scope="col" className="py-3 pr-4 font-medium">Название</th>
            <th scope="col" className="py-3 pr-4 font-medium">Отрасль</th>
            <th scope="col" className="py-3 pr-4 font-medium">Город</th>
            <th scope="col" className="py-3 pr-4 text-right font-medium">Контакты</th>
            <th scope="col" className="py-3 text-right font-medium">Сделки</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id} className="border-b border-line transition-colors hover:bg-subtle">
              <td className="py-4 pr-4">
                <Link href={`/accounts/${account.id}`} className="rounded-sm font-semibold hover:text-accent">
                  {account.name}
                </Link>
              </td>
              <td className="py-4 pr-4 text-ink-secondary">{account.industry ?? "—"}</td>
              <td className="py-4 pr-4 text-ink-secondary">{account.city ?? "—"}</td>
              <td className="py-4 pr-4 text-right tabular-nums">{account._count.contacts}</td>
              <td className="py-4 text-right tabular-nums">{account._count.opportunities}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line border-y border-line md:hidden">
        {accounts.map((account) => (
          <li key={account.id}>
            <Link href={`/accounts/${account.id}`} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{account.name}</p>
                <p className="truncate text-small text-ink-secondary">
                  {[account.industry, account.city].filter(Boolean).join(" · ") || "Без отрасли и города"}
                </p>
                <p className="text-small text-ink-secondary">
                  {pluralRu(account._count.contacts, ["контакт", "контакта", "контактов"])} ·{" "}
                  {pluralRu(account._count.opportunities, ["сделка", "сделки", "сделок"])}
                </p>
              </div>
              <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-ink-secondary" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
