import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { LeadForm } from "@/components/leads/lead-form";
import { PageHeader } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Block } from "@/components/ui/block";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { dateInputValue } from "@/lib/format";
import { updateLeadAction } from "@/server/actions/leads";
import { getLead } from "@/server/queries/leads";
import { CONVERTED_LEAD_READONLY_MESSAGE } from "@/server/services/leads";

export const metadata: Metadata = { title: "Изменить лид" };

export default function EditLeadPage({ params }: PageProps<"/leads/[id]/edit">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <EditLead params={params} />
    </Suspense>
  );
}

async function EditLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const header = (
    <PageHeader title="Изменить лид" description={lead.contactName} back={{ href: `/leads/${id}`, label: lead.contactName }} />
  );

  // Сервис всё равно отклонит изменение; здесь — понятный экран вместо формы, которую нельзя сохранить.
  if (lead.status === "converted") {
    return (
      <>
        {header}
        <Block>
          <EmptyState
            icon={Lock}
            title="Лид уже конвертирован"
            description={CONVERTED_LEAD_READONLY_MESSAGE}
            action={<ArrowLink href={`/leads/${id}`}>Вернуться к лиду</ArrowLink>}
            className="min-h-64"
          />
        </Block>
      </>
    );
  }

  return (
    <>
      {header}
      <LeadForm
        action={updateLeadAction.bind(null, id)}
        initial={{
          contactName: lead.contactName,
          companyName: lead.companyName,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          status: lead.status,
          budget: lead.budget,
          venue: lead.venue,
          eventDate: dateInputValue(lead.eventDate),
          workFormat: lead.workFormat,
          comment: lead.comment,
        }}
        submitLabel="Сохранить"
        cancelHref={`/leads/${id}`}
      />
    </>
  );
}
