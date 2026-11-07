import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Pencil } from "lucide-react";
import { ActivityFeed } from "@/components/activities/activity-feed";
import { RelatedDeals } from "@/components/deals/related-deals";
import { PageHeader } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Block } from "@/components/ui/block";
import { buttonClasses } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Details, valueLinkClasses } from "@/components/ui/details";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";
import { websiteHref } from "@/lib/format";
import { deleteAccountAction } from "@/server/actions/accounts";
import { listActivities } from "@/server/queries/activities";
import { getAccount } from "@/server/queries/accounts";
import { listRelatedDeals } from "@/server/queries/deals";
import { getAccountDeleteImpact } from "@/server/services/accounts";
import { getAppToday } from "@/server/today";

export const metadata: Metadata = { title: "Компания" };

export default function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <AccountCard params={params} />
    </Suspense>
  );
}

async function AccountCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { today, timeZone } = await getAppToday();
  const [account, impact, deals, activities] = await Promise.all([
    getAccount(id),
    getAccountDeleteImpact(id),
    listRelatedDeals({ accountId: id }),
    listActivities({ type: "account", id }, today, timeZone),
  ]);
  if (!account) notFound();

  return (
    <>
      <PageHeader
        title={account.name}
        description={[account.industry, account.city].filter(Boolean).join(" · ") || undefined}
        back={{ href: "/accounts", label: "Компании" }}
        actions={
          <>
            <Link href={`/accounts/${id}/edit`} className={buttonClasses("secondary")}>
              <Pencil aria-hidden="true" size={16} />
              Изменить
            </Link>
            <DeleteButton
              title={`Удалить компанию «${account.name}»?`}
              consequences={impact.consequences}
              blockedReason={impact.blockedReason}
              action={deleteAccountAction.bind(null, id)}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-x-10 gap-y-8 xl:grid-cols-12">
        <div className="flex flex-col gap-10 xl:col-span-7">
          <Section title="Данные компании">
            <Details
              items={[
                { label: "Отрасль", value: account.industry },
                { label: "Город", value: account.city },
                {
                  label: "Сайт",
                  value: account.website && (
                    <a href={websiteHref(account.website)} target="_blank" rel="noopener noreferrer" className={valueLinkClasses}>
                      {account.website}
                    </a>
                  ),
                },
                {
                  label: "Email",
                  value: account.email && (
                    <a href={`mailto:${account.email}`} className={valueLinkClasses}>
                      {account.email}
                    </a>
                  ),
                },
                {
                  label: "Телефон",
                  value: account.phone && (
                    <a href={`tel:${account.phone.replace(/[^\d+]/g, "")}`} className={valueLinkClasses}>
                      {account.phone}
                    </a>
                  ),
                },
                { label: "Комментарий", value: account.comment && <span className="whitespace-pre-line">{account.comment}</span> },
              ]}
            />
          </Section>
          <ActivityFeed parent={{ type: "account", id }} activities={activities} />
        </div>

        <div className="flex flex-col gap-6 xl:col-span-5">
          <Block
            title={`Контакты · ${account.contacts.length}`}
            action={<ArrowLink href={`/contacts/new?accountId=${id}`}>Добавить</ArrowLink>}
          >
            <div className="rounded-lg bg-card px-4 py-2">
              {account.contacts.length === 0 ? (
                <p className="py-4 text-body text-ink-secondary">У компании пока нет контактов.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {account.contacts.map((contact) => (
                    <li key={contact.id} className="py-3">
                      <Link href={`/contacts/${contact.id}`} className="rounded-sm font-semibold hover:text-accent">
                        {contact.fullName}
                      </Link>
                      <p className="text-small text-ink-secondary">
                        {[contact.position, contact.email, contact.phone].filter(Boolean).join(" · ") || "Нет данных для связи"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Block>
          <RelatedDeals deals={deals} emptyText="У компании пока нет сделок." addHref={`/deals/new?accountId=${id}`} />
        </div>
      </div>
    </>
  );
}
