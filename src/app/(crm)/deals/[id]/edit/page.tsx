import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DealForm } from "@/components/deals/deal-form";
import { PageHeader } from "@/components/shell/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { dateInputValue } from "@/lib/format";
import { updateDealAction } from "@/server/actions/deals";
import { listAccountOptions } from "@/server/queries/accounts";
import { listContactOptions } from "@/server/queries/contacts";
import { getDeal } from "@/server/queries/deals";

export const metadata: Metadata = { title: "Изменить сделку" };

export default function EditDealPage({ params }: PageProps<"/deals/[id]/edit">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <EditDeal params={params} />
    </Suspense>
  );
}

async function EditDeal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deal, accounts, contacts] = await Promise.all([getDeal(id), listAccountOptions(), listContactOptions()]);
  if (!deal) notFound();

  return (
    <>
      <PageHeader title="Изменить сделку" description={deal.name} back={{ href: `/deals/${id}`, label: deal.name }} />
      <DealForm
        action={updateDealAction.bind(null, id)}
        accounts={accounts}
        contacts={contacts.map((c) => ({ id: c.id, fullName: c.fullName, accountName: c.account?.name ?? null }))}
        stage={{ current: { name: deal.stage.name, type: deal.stage.type } }}
        initial={{
          name: deal.name,
          accountId: deal.accountId,
          contactId: deal.contactId,
          amount: deal.amount,
          lostReason: deal.lostReason,
          venue: deal.venue,
          eventDate: dateInputValue(deal.eventDate),
          workFormat: deal.workFormat,
          expectedCloseDate: dateInputValue(deal.expectedCloseDate),
          comment: deal.comment,
        }}
        submitLabel="Сохранить"
        cancelHref={`/deals/${id}`}
      />
    </>
  );
}
