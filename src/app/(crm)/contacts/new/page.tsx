import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactForm } from "@/components/contacts/contact-form";
import { PageHeader } from "@/components/shell/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { createContactAction } from "@/server/actions/contacts";
import { listAccountOptions } from "@/server/queries/accounts";

export const metadata: Metadata = { title: "Новый контакт" };

export default function NewContactPage({ searchParams }: PageProps<"/contacts/new">) {
  return (
    <>
      <PageHeader title="Новый контакт" back={{ href: "/contacts", label: "Контакты" }} />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <NewContactForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewContactForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ accountId }, accounts] = await Promise.all([searchParams, listAccountOptions()]);
  // Переход из карточки компании («Добавить контакт») подставляет её в форму.
  const preselected = typeof accountId === "string" && accounts.some((a) => a.id === accountId) ? accountId : undefined;

  return (
    <ContactForm
      action={createContactAction}
      accounts={accounts}
      initial={{ accountId: preselected }}
      submitLabel="Создать контакт"
      cancelHref={preselected ? `/accounts/${preselected}` : "/contacts"}
    />
  );
}
