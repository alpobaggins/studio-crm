import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleX, Trophy, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Воронка" };

// Каркас Kanban по DESIGN.md. Подписи совпадают со стадиями из миграции (Plan.md 1.4);
// на шаге 11 колонки строятся из таблицы Stage.
const OPEN_STAGES = ["Бриф", "Концепция и смета", "Согласование", "Договор"];
const CLOSED_STAGES: { name: string; icon: LucideIcon }[] = [
  { name: "Выиграна", icon: Trophy },
  { name: "Проиграна", icon: CircleX },
];

function Column({ name, icon: Icon }: { name: string; icon?: LucideIcon }) {
  return (
    <section aria-label={name} className="flex w-[272px] max-w-[80vw] shrink-0 snap-start flex-col gap-3">
      <header className="px-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon aria-hidden="true" size={16} strokeWidth={2} className="text-ink-secondary" />}
          <h2 className="truncate text-title-3">{name}</h2>
          <span className="ml-auto rounded-full bg-control px-2 text-small font-medium tabular-nums">0</span>
        </div>
        <p className="mt-1 text-small tabular-nums text-ink-secondary">0 ₽</p>
      </header>
      <div className="flex min-h-[360px] flex-col rounded-lg bg-subtle p-2">
        <p className="px-2 py-8 text-center text-small text-ink-secondary">Пока нет сделок</p>
      </div>
    </section>
  );
}

export default function PipelinePage() {
  return (
    <>
      <PageHeader
        title="Воронка"
        description="Сделки по стадиям — от брифа до результата."
        actions={
          <Link href="/deals" className={buttonClasses("secondary")}>
            Список сделок
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        }
      />
      <div
        role="region"
        aria-label="Колонки воронки"
        tabIndex={0}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {OPEN_STAGES.map((name) => (
          <Column key={name} name={name} />
        ))}
        {/* Закрытые стадии — результат, а не следующий этап работы: отделены линией. */}
        <div aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-line" />
        {CLOSED_STAGES.map((stage) => (
          <Column key={stage.name} name={stage.name} icon={stage.icon} />
        ))}
      </div>
    </>
  );
}
