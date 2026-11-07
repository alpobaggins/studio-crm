import type { Metadata } from "next";
import { Suspense } from "react";
import { DealForm } from "@/components/deals/deal-form";
import { PageHeader } from "@/components/shell/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { createDealAction } from "@/server/actions/deals";
import { listAccountOptions } from "@/server/queries/accounts";
import { listContactOptions } from "@/server/queries/contacts";
import { listStages } from "@/server/queries/deals";

export const metadata: Metadata = { title: "Новая сделка" };

export default function NewDealPage({ searchParams }: PageProps<"/deals/new">) {
  return (
    <>
      <PageHeader title="Новая сделка" back={{ href: "/deals", label: "Сделки" }} />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <NewDealForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewDealForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, accounts, contacts, stages] = await Promise.all([
    searchParams,
    listAccountOptions(),
    listContactOptions(),
    listStages(),
  ]);
  const openStages = stages.filter((stage) => stage.type === "open");
  // Быстрое создание из карточки компании или контакта подставляет их в форму. Подставляются только
  // существующие записи; компания остаётся обязательной и выбирается в форме, если у контакта её нет.
  const accountId = accounts.find((a) => a.id === params.accountId)?.id;
  const contactId = contacts.find((c) => c.id === params.contactId)?.id;
  const cancelHref = contactId ? `/contacts/${contactId}` : accountId ? `/accounts/${accountId}` : "/deals";

  return (
    <DealForm
      action={createDealAction}
      accounts={accounts}
      contacts={contacts.map((c) => ({ id: c.id, fullName: c.fullName, accountName: c.account?.name ?? null }))}
      stage={{ openStages }}
      initial={{ stageId: openStages[0]?.id, accountId, contactId }}
      submitLabel="Создать сделку"
      cancelHref={cancelHref}
    />
  );
}
