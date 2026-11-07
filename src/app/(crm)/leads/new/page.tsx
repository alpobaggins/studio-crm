import type { Metadata } from "next";
import { LeadForm } from "@/components/leads/lead-form";
import { PageHeader } from "@/components/shell/page-header";
import { createLeadAction } from "@/server/actions/leads";

export const metadata: Metadata = { title: "Новый лид" };

export default function NewLeadPage() {
  return (
    <>
      <PageHeader title="Новый лид" back={{ href: "/leads", label: "Лиды" }} />
      <LeadForm action={createLeadAction} initial={{ status: "new" }} submitLabel="Создать лид" cancelHref="/leads" />
    </>
  );
}
