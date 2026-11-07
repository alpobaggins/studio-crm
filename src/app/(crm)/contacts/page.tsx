import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/ui/block";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { pluralRu } from "@/lib/format";
import { listContacts } from "@/server/queries/contacts";

export const metadata: Metadata = { title: "Контакты" };

const createButton = (
  <Link href="/contacts/new" className={buttonClasses("primary")}>
    <Plus aria-hidden="true" size={18} />
    Создать контакт
  </Link>
);

export default function ContactsPage() {
  return (
    <>
      <PageHeader title="Контакты" description="Контактные лица со стороны клиентов." actions={createButton} />
      <Suspense fallback={<ListSkeleton />}>
        <ContactsList />
      </Suspense>
    </>
  );
}

async function ContactsList() {
  const contacts = await listContacts();

  if (contacts.length === 0) {
    return (
      <Block>
        <EmptyState
          icon={Users}
          title="Контактов пока нет"
          description="Добавьте контактное лицо клиента. Компанию можно указать сразу или позже."
          action={createButton}
          className="min-h-80"
        />
      </Block>
    );
  }

  return (
    <>
      <p className="mb-3 text-small text-ink-secondary">
        {pluralRu(contacts.length, ["контакт", "контакта", "контактов"])}
      </p>

      <table className="hidden w-full text-left md:table">
        <thead>
          <tr className="border-b border-line text-caption text-ink-secondary">
            <th scope="col" className="py-3 pr-4 font-medium">Имя</th>
            <th scope="col" className="py-3 pr-4 font-medium">Компания</th>
            <th scope="col" className="py-3 pr-4 font-medium">Должность</th>
            <th scope="col" className="py-3 pr-4 font-medium">Email</th>
            <th scope="col" className="py-3 font-medium">Телефон</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="border-b border-line transition-colors hover:bg-subtle">
              <td className="py-4 pr-4">
                <Link href={`/contacts/${contact.id}`} className="rounded-sm font-semibold hover:text-accent">
                  {contact.fullName}
                </Link>
              </td>
              <td className="py-4 pr-4">
                {contact.account ? (
                  <Link href={`/accounts/${contact.account.id}`} className="rounded-sm hover:text-accent">
                    {contact.account.name}
                  </Link>
                ) : (
                  <span className="text-ink-secondary">Без компании</span>
                )}
              </td>
              <td className="py-4 pr-4 text-ink-secondary">{contact.position ?? "—"}</td>
              <td className="max-w-56 truncate py-4 pr-4 text-ink-secondary">{contact.email ?? "—"}</td>
              <td className="whitespace-nowrap py-4 text-ink-secondary">{contact.phone ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line border-y border-line md:hidden">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{contact.fullName}</p>
                <p className="truncate text-small text-ink-secondary">
                  {[contact.account?.name ?? "Без компании", contact.position].filter(Boolean).join(" · ")}
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
