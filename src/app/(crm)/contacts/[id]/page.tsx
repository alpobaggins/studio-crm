import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Building2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Block } from "@/components/ui/block";
import { buttonClasses } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Details, valueLinkClasses } from "@/components/ui/details";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";
import { deleteContactAction } from "@/server/actions/contacts";
import { getContact } from "@/server/queries/contacts";
import { getContactDeleteImpact } from "@/server/services/contacts";

export const metadata: Metadata = { title: "Контакт" };

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <ContactCard params={params} />
    </Suspense>
  );
}

async function ContactCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contact, impact] = await Promise.all([getContact(id), getContactDeleteImpact(id)]);
  if (!contact) notFound();

  return (
    <>
      <PageHeader
        title={contact.fullName}
        description={[contact.position, contact.account?.name].filter(Boolean).join(" · ") || undefined}
        back={{ href: "/contacts", label: "Контакты" }}
        actions={
          <>
            <Link href={`/contacts/${id}/edit`} className={buttonClasses("secondary")}>
              <Pencil aria-hidden="true" size={16} />
              Изменить
            </Link>
            <DeleteButton
              title={`Удалить контакт «${contact.fullName}»?`}
              consequences={impact.consequences}
              blockedReason={impact.blockedReason}
              action={deleteContactAction.bind(null, id)}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-x-10 gap-y-8 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Section title="Данные контакта">
            <Details
              items={[
                { label: "Должность", value: contact.position },
                {
                  label: "Email",
                  value: contact.email && (
                    <a href={`mailto:${contact.email}`} className={valueLinkClasses}>
                      {contact.email}
                    </a>
                  ),
                },
                {
                  label: "Телефон",
                  value: contact.phone && (
                    <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={valueLinkClasses}>
                      {contact.phone}
                    </a>
                  ),
                },
                { label: "Комментарий", value: contact.comment && <span className="whitespace-pre-line">{contact.comment}</span> },
              ]}
            />
          </Section>
        </div>

        <div className="xl:col-span-5">
          <Block title="Компания">
            {contact.account ? (
              <div className="rounded-lg bg-card px-4 py-4">
                <Link href={`/accounts/${contact.account.id}`} className="rounded-sm text-title-3 hover:text-accent">
                  {contact.account.name}
                </Link>
                <p className="mt-1 text-small text-ink-secondary">
                  {[contact.account.industry, contact.account.city].filter(Boolean).join(" · ") || "Отрасль и город не указаны"}
                </p>
              </div>
            ) : (
              <EmptyState
                icon={Building2}
                title="Компания не указана"
                description="Контакт может существовать без компании."
                action={<ArrowLink href={`/contacts/${id}/edit`}>Указать компанию</ArrowLink>}
                className="py-8"
              />
            )}
          </Block>
          {impact.opportunities > 0 && (
            <p className="mt-3 px-1 text-small text-ink-secondary">Связанные сделки: {impact.opportunities}.</p>
          )}
        </div>
      </div>
    </>
  );
}
