import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContactForm } from "@/components/contacts/contact-form";
import { PageHeader } from "@/components/shell/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { updateContactAction } from "@/server/actions/contacts";
import { listAccountOptions } from "@/server/queries/accounts";
import { getContact } from "@/server/queries/contacts";

export const metadata: Metadata = { title: "Изменить контакт" };

export default function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <EditContact params={params} />
    </Suspense>
  );
}

async function EditContact({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contact, accounts] = await Promise.all([getContact(id), listAccountOptions()]);
  if (!contact) notFound();

  return (
    <>
      <PageHeader title="Изменить контакт" description={contact.fullName} back={{ href: `/contacts/${id}`, label: contact.fullName }} />
      <ContactForm
        action={updateContactAction.bind(null, id)}
        accounts={accounts}
        initial={contact}
        submitLabel="Сохранить"
        cancelHref={`/contacts/${id}`}
      />
    </>
  );
}
