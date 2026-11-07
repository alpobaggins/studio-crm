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

export default function NewDealPage() {
  return (
    <>
      <PageHeader title="Новая сделка" back={{ href: "/deals", label: "Сделки" }} />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <NewDealForm />
      </Suspense>
    </>
  );
}

async function NewDealForm() {
  const [accounts, contacts, stages] = await Promise.all([listAccountOptions(), listContactOptions(), listStages()]);
  const openStages = stages.filter((stage) => stage.type === "open");

  return (
    <DealForm
      action={createDealAction}
      accounts={accounts}
      contacts={contacts.map((c) => ({ id: c.id, fullName: c.fullName, accountName: c.account?.name ?? null }))}
      stage={{ openStages }}
      initial={{ stageId: openStages[0]?.id }}
      submitLabel="Создать сделку"
      cancelHref="/deals"
    />
  );
}
