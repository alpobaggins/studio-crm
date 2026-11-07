import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Ban, Lock } from "lucide-react";
import { LeadConvertForm } from "@/components/leads/lead-convert-form";
import { PageHeader } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Block } from "@/components/ui/block";
import { Details } from "@/components/ui/details";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { LEAD_SOURCE_LABELS } from "@/lib/leads";
import { convertLeadAction } from "@/server/actions/leads";
import { listAccountOptions } from "@/server/queries/accounts";
import { listStages } from "@/server/queries/deals";
import { countLeadActivities, getLead } from "@/server/queries/leads";
import { ALREADY_CONVERTED_MESSAGE, DISQUALIFIED_MESSAGE } from "@/server/services/lead-conversion";

export const metadata: Metadata = { title: "Конвертировать лид" };

export default function ConvertLeadPage({ params }: PageProps<"/leads/[id]/convert">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <ConvertLead params={params} />
    </Suspense>
  );
}

async function ConvertLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, accounts, stages, activities] = await Promise.all([
    getLead(id),
    listAccountOptions(),
    listStages(),
    countLeadActivities(id),
  ]);
  if (!lead) notFound();
  const convertible = lead.status !== "converted" && lead.status !== "disqualified";

  const header = (
    <PageHeader
      title="Конвертировать лид"
      description={
        convertible ? `${lead.contactName} станет контактом, компания — новой или из базы, сделка — по выбору` : lead.contactName
      }
      back={{ href: `/leads/${id}`, label: lead.contactName }}
    />
  );

  // Сервис всё равно отклонит конвертацию; здесь — объяснение вместо формы, которую нельзя отправить.
  if (!convertible) {
    const converted = lead.status === "converted";
    return (
      <>
        {header}
        <Block>
          <EmptyState
            icon={converted ? Lock : Ban}
            title={converted ? "Лид уже конвертирован" : "Конвертация недоступна"}
            description={converted ? ALREADY_CONVERTED_MESSAGE : DISQUALIFIED_MESSAGE}
            action={
              converted ? (
                <ArrowLink href={`/leads/${id}`}>Связанные записи</ArrowLink>
              ) : (
                <ArrowLink href={`/leads/${id}/edit`}>Изменить статус</ArrowLink>
              )
            }
            className="min-h-64"
          />
        </Block>
      </>
    );
  }

  const openStages = stages.filter((stage) => stage.type === "open");
  const organization = lead.companyName ?? lead.contactName;

  return (
    <>
      {header}
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <LeadConvertForm
            action={convertLeadAction.bind(null, id)}
            initial={{
              fullName: lead.contactName,
              email: lead.email,
              phone: lead.phone,
              companyName: lead.companyName,
              // Названия сделки в лиде нет: предлагаем «формат работ — компания», его можно изменить.
              dealName: lead.workFormat ? `${lead.workFormat} — ${organization}` : organization,
              stageId: openStages[0]?.id,
              amount: lead.budget,
            }}
            accounts={accounts}
            openStages={openStages}
            activities={activities}
            cancelHref={`/leads/${id}`}
          />
        </div>
        <div className="xl:col-span-5">
          <Block title="Данные лида">
            <div className="rounded-lg bg-card px-4 py-1 sm:px-5">
              <Details
                items={[
                  { label: "Имя контакта", value: lead.contactName },
                  { label: "Компания", value: lead.companyName },
                  { label: "Email", value: lead.email },
                  { label: "Телефон", value: lead.phone },
                  { label: "Источник", value: LEAD_SOURCE_LABELS[lead.source] },
                  { label: "Бюджет", value: lead.budget && <span className="tabular-nums">{formatMoney(lead.budget)}</span> },
                  { label: "Площадка", value: lead.venue },
                  { label: "Дата мероприятия", value: lead.eventDate && formatDate(lead.eventDate) },
                  { label: "Формат работ", value: lead.workFormat },
                  { label: "Комментарий", value: lead.comment && <span className="whitespace-pre-line">{lead.comment}</span> },
                ]}
              />
            </div>
          </Block>
        </div>
      </div>
    </>
  );
}
