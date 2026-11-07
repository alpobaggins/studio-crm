import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountForm } from "@/components/accounts/account-form";
import { PageHeader } from "@/components/shell/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { updateAccountAction } from "@/server/actions/accounts";
import { getAccount } from "@/server/queries/accounts";

export const metadata: Metadata = { title: "Изменить компанию" };

export default function EditAccountPage({ params }: PageProps<"/accounts/[id]/edit">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <EditAccount params={params} />
    </Suspense>
  );
}

async function EditAccount({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  return (
    <>
      <PageHeader title="Изменить компанию" description={account.name} back={{ href: `/accounts/${id}`, label: account.name }} />
      <AccountForm
        action={updateAccountAction.bind(null, id)}
        initial={account}
        submitLabel="Сохранить"
        cancelHref={`/accounts/${id}`}
      />
    </>
  );
}
