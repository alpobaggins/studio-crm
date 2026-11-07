import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/ui/block";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Компании" };

export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Компании" description="Клиенты агентства и их сделки." />
      <Block>
        <EmptyState
          icon={Building2}
          title="Раздел в разработке"
          description="Здесь будет список компаний со связанными контактами и сделками."
          className="min-h-80"
        />
      </Block>
    </>
  );
}
