import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { PipelineBoard } from "@/components/deals/pipeline-board";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listContactOptions } from "@/server/queries/contacts";
import { getPipeline } from "@/server/queries/deals";

export const metadata: Metadata = { title: "Воронка" };

export default function PipelinePage() {
  return (
    <>
      <PageHeader
        title="Воронка"
        description="Сделки по стадиям — от брифа до результата. Перетащите карточку или нажмите «Сменить стадию» на ней."
        actions={
          <Link href="/deals" className={buttonClasses("secondary")}>
            Список сделок
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        }
      />
      <Suspense fallback={<BoardSkeleton />}>
        <Board />
      </Suspense>
    </>
  );
}

// Колонки строятся из справочника Stage (Plan.md 1.4); данные читаются из базы при каждом запросе.
async function Board() {
  const [columns, contacts] = await Promise.all([getPipeline(), listContactOptions()]);
  return (
    <PipelineBoard
      columns={columns}
      contacts={contacts.map((c) => ({ id: c.id, fullName: c.fullName, accountName: c.account?.name ?? null }))}
    />
  );
}

function BoardSkeleton() {
  return (
    <div role="status" aria-label="Загрузка" className="flex gap-4 overflow-hidden">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex w-[272px] max-w-[80vw] shrink-0 flex-col gap-3">
          <Skeleton className="h-10 rounded-sm" />
          <Skeleton className="h-[360px] rounded-lg" />
        </div>
      ))}
    </div>
  );
}
