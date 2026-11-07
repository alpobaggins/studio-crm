import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Pencil, UserRound } from "lucide-react";
import { DealStatusBadge } from "@/components/deals/deal-status-badge";
import { PageHeader } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Block } from "@/components/ui/block";
import { buttonClasses } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Details } from "@/components/ui/details";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";
import { getAppTimeZone } from "@/lib/dates";
import { formatDate, formatDateInZone, formatMoney } from "@/lib/format";
import { deleteDealAction } from "@/server/actions/deals";
import { getDeal } from "@/server/queries/deals";
import { getDealDeleteImpact } from "@/server/services/deals";

export const metadata: Metadata = { title: "Сделка" };

export default function DealPage({ params }: PageProps<"/deals/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <DealCard params={params} />
    </Suspense>
  );
}

async function DealCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deal, impact] = await Promise.all([getDeal(id), getDealDeleteImpact(id)]);
  if (!deal) notFound();
  const timeZone = getAppTimeZone();

  return (
    <>
      <PageHeader
        title={deal.name}
        description={[deal.account.name, deal.stage.name].join(" · ")}
        back={{ href: "/deals", label: "Сделки" }}
        actions={
          <>
            <Link href={`/deals/${id}/edit`} className={buttonClasses("secondary")}>
              <Pencil aria-hidden="true" size={16} />
              Изменить
            </Link>
            <DeleteButton
              title={`Удалить сделку «${deal.name}»?`}
              consequences={impact.consequences}
              blockedReason={impact.blockedReason}
              action={deleteDealAction.bind(null, id)}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-x-10 gap-y-8 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Section title="Данные сделки">
            <Details
              items={[
                { label: "Стадия", value: deal.stage.name },
                { label: "Статус", value: <DealStatusBadge type={deal.stage.type} /> },
                {
                  label: "Сумма",
                  value: deal.amount ? (
                    <span className="font-semibold tabular-nums">{formatMoney(deal.amount)}</span>
                  ) : (
                    <span className="text-ink-secondary">Сумма не указана</span>
                  ),
                },
                ...(deal.stage.type === "lost" ? [{ label: "Причина проигрыша", value: deal.lostReason }] : []),
                ...(deal.closedAt ? [{ label: "Закрыта", value: formatDateInZone(deal.closedAt, timeZone) }] : []),
                { label: "Ожидаемое закрытие", value: deal.expectedCloseDate && formatDate(deal.expectedCloseDate) },
                { label: "Дата мероприятия", value: deal.eventDate && formatDate(deal.eventDate) },
                { label: "Площадка", value: deal.venue },
                { label: "Формат работ", value: deal.workFormat },
                { label: "Комментарий", value: deal.comment && <span className="whitespace-pre-line">{deal.comment}</span> },
                { label: "Создана", value: formatDateInZone(deal.createdAt, timeZone) },
              ]}
            />
          </Section>
        </div>

        <div className="flex flex-col gap-6 xl:col-span-5">
          <Block title="Компания">
            <div className="rounded-lg bg-card px-4 py-4">
              <Link href={`/accounts/${deal.account.id}`} className="rounded-sm text-title-3 hover:text-accent">
                {deal.account.name}
              </Link>
              <p className="mt-1 text-small text-ink-secondary">
                {[deal.account.industry, deal.account.city].filter(Boolean).join(" · ") || "Отрасль и город не указаны"}
              </p>
            </div>
          </Block>

          <Block title="Контакт">
            {deal.contact ? (
              <div className="rounded-lg bg-card px-4 py-4">
                <Link href={`/contacts/${deal.contact.id}`} className="rounded-sm text-title-3 hover:text-accent">
                  {deal.contact.fullName}
                </Link>
                {/* Компания контакта может отличаться от компании сделки: связи независимы (Plan.md 1.5). */}
                <p className="mt-1 text-small text-ink-secondary">
                  {[deal.contact.position, deal.contact.account ? deal.contact.account.name : "Без компании"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ) : (
              <EmptyState
                icon={UserRound}
                title="Контакт не указан"
                description="Пока сделка открыта, контакт можно не указывать. Для выигрыша он обязателен."
                action={<ArrowLink href={`/deals/${id}/edit`}>Указать контакт</ArrowLink>}
                className="py-8"
              />
            )}
          </Block>
        </div>
      </div>
    </>
  );
}
