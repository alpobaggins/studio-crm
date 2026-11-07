import type { Metadata } from "next";
import { Handshake } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/ui/block";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Сделки" };

export default function DealsPage() {
  return (
    <>
      <PageHeader title="Сделки" description="Все сделки агентства: открытые, выигранные и проигранные." />
      <Block>
        <EmptyState
          icon={Handshake}
          title="Раздел в разработке"
          description="Здесь будет список сделок с фильтрами по стадии и статусу."
          className="min-h-80"
        />
      </Block>
    </>
  );
}
