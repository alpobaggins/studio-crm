import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ArrowRightLeft, Pencil } from "lucide-react";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/ui/block";
import { Button, buttonClasses } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Details, valueLinkClasses } from "@/components/ui/details";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";
import { getAppTimeZone } from "@/lib/dates";
import { formatDate, formatDateInZone, formatMoney } from "@/lib/format";
import { CONVERTIBLE_LEAD_STATUSES, LEAD_SOURCE_LABELS } from "@/lib/leads";
import { deleteLeadAction } from "@/server/actions/leads";
import { getLead } from "@/server/queries/leads";
import { getLeadDeleteImpact } from "@/server/services/leads";

export const metadata: Metadata = { title: "Лид" };

export default function LeadPage({ params }: PageProps<"/leads/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <LeadCard params={params} />
    </Suspense>
  );
}

type Lead = NonNullable<Awaited<ReturnType<typeof getLead>>>;

async function LeadCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, impact] = await Promise.all([getLead(id), getLeadDeleteImpact(id)]);
  if (!lead) notFound();
  const converted = lead.status === "converted";

  return (
    <>
      <PageHeader
        title={lead.contactName}
        description={[lead.companyName ?? "Компания не указана", LEAD_SOURCE_LABELS[lead.source]].join(" · ")}
        back={{ href: "/leads", label: "Лиды" }}
        actions={
          <>
            {/* Основные поля конвертированного лида доступны только для чтения (Plan.md 1.3). */}
            {!converted && (
              <Link href={`/leads/${id}/edit`} className={buttonClasses("secondary")}>
                <Pencil aria-hidden="true" size={16} />
                Изменить
              </Link>
            )}
            <DeleteButton
              title={`Удалить лид «${lead.contactName}»?`}
              consequences={impact.consequences}
              blockedReason={impact.blockedReason}
              action={deleteLeadAction.bind(null, id)}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-x-10 gap-y-8 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Section title="Данные лида">
            <Details
              items={[
                { label: "Статус", value: <LeadStatusBadge status={lead.status} /> },
                { label: "Источник", value: LEAD_SOURCE_LABELS[lead.source] },
                { label: "Компания", value: lead.companyName },
                {
                  label: "Email",
                  value: lead.email && (
                    <a href={`mailto:${lead.email}`} className={valueLinkClasses}>
                      {lead.email}
                    </a>
                  ),
                },
                {
                  label: "Телефон",
                  value: lead.phone && (
                    <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className={valueLinkClasses}>
                      {lead.phone}
                    </a>
                  ),
                },
                { label: "Бюджет", value: lead.budget && <span className="tabular-nums">{formatMoney(lead.budget)}</span> },
                { label: "Площадка", value: lead.venue },
                { label: "Дата мероприятия", value: lead.eventDate && formatDate(lead.eventDate) },
                { label: "Формат работ", value: lead.workFormat },
                { label: "Комментарий", value: lead.comment && <span className="whitespace-pre-line">{lead.comment}</span> },
                { label: "Создан", value: formatDateInZone(lead.createdAt, getAppTimeZone()) },
              ]}
            />
          </Section>
        </div>

        <div className="xl:col-span-5">
          <Block title="Конвертация">
            <div className="rounded-lg bg-card px-4 py-4 sm:px-5">
              {converted ? <ConvertedLinks lead={lead} /> : <ConvertPlaceholder status={lead.status} />}
            </div>
          </Block>
        </div>
      </div>
    </>
  );
}

/**
 * Конвертация появится на шаге 10. До этого кнопка неактивна, причина написана рядом текстом
 * (DESIGN.md, «Кнопки»: неактивная кнопка — `text-disabled`, причина рядом).
 */
function ConvertPlaceholder({ status }: { status: Lead["status"] }) {
  const convertible = CONVERTIBLE_LEAD_STATUSES.includes(status);
  return (
    <div className="flex flex-col items-start gap-3">
      <p id="convert-reason" className="text-body text-ink-secondary">
        {convertible
          ? "Конвертация в контакт, компанию и сделку пока недоступна — она появится в следующей версии."
          : "Отклонённый лид нельзя конвертировать. Сначала верните его в работу: измените статус."}
      </p>
      <Button disabled aria-describedby="convert-reason">
        <ArrowRightLeft aria-hidden="true" size={18} />
        Конвертировать
      </Button>
    </div>
  );
}

/** Связанные записи конвертированного лида. Пустая ссылка означает, что запись удалили (Plan.md 1.8). */
function ConvertedLinks({ lead }: { lead: Lead }) {
  return (
    <div className="flex flex-col gap-3">
      {lead.convertedAt && (
        <p className="text-body text-ink-secondary">Конвертирован {formatDateInZone(lead.convertedAt, getAppTimeZone())}.</p>
      )}
      <dl className="divide-y divide-line">
        <LinkRow label="Компания">
          {lead.convertedAccount ? (
            <Link href={`/accounts/${lead.convertedAccount.id}`} className={valueLinkClasses}>
              {lead.convertedAccount.name}
            </Link>
          ) : (
            <span className="text-ink-secondary">Компания удалена</span>
          )}
        </LinkRow>
        <LinkRow label="Контакт">
          {lead.convertedContact ? (
            <Link href={`/contacts/${lead.convertedContact.id}`} className={valueLinkClasses}>
              {lead.convertedContact.fullName}
            </Link>
          ) : (
            <span className="text-ink-secondary">Контакт удалён</span>
          )}
        </LinkRow>
        <LinkRow label="Сделка">
          {/* Страницы сделок появятся на шаге 08; до этого — название без ссылки. */}
          {lead.convertedOpportunity ? (
            lead.convertedOpportunity.name
          ) : (
            <span className="text-ink-secondary">Сделка не создана или удалена</span>
          )}
        </LinkRow>
      </dl>
    </div>
  );
}

function LinkRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[96px_1fr] sm:gap-4">
      <dt className="text-small text-ink-secondary sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words text-body">{children}</dd>
    </div>
  );
}
