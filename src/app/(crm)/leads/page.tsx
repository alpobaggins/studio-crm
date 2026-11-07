import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/ui/block";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Лиды" };

export default function LeadsPage() {
  return (
    <>
      <PageHeader title="Лиды" description="Входящие запросы с сайта, почты, телефона, по рекомендациям и вручную." />
      <Block>
        <EmptyState
          icon={Inbox}
          title="Раздел в разработке"
          description="Здесь будет список лидов с поиском и фильтрами по источнику и статусу."
          className="min-h-80"
        />
      </Block>
    </>
  );
}
