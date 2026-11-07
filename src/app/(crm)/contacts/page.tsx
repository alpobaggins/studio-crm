import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/ui/block";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Контакты" };

export default function ContactsPage() {
  return (
    <>
      <PageHeader title="Контакты" description="Контактные лица со стороны клиентов." />
      <Block>
        <EmptyState
          icon={Users}
          title="Раздел в разработке"
          description="Здесь будет список контактов с компаниями и связанными сделками."
          className="min-h-80"
        />
      </Block>
    </>
  );
}
