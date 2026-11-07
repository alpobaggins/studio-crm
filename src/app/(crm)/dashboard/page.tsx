import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChartColumn, ChartNoAxesColumn } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Block } from "@/components/ui/block";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = { title: "Дашборд" };

// Каркас по DESIGN.md, раздел 6. Показатели подключаются на шаге 13.
const KPI_LABELS = ["Всего лидов", "Открытых сделок", "Сумма открытых сделок", "Просроченных задач"];

const SECTIONS = ["Сводка по статусам лидов", "Сводка по источникам лидов", "Новые лиды", "Просроченные задачи"];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Дашборд"
        description="Лиды, сделки и задачи агентства — по текущему состоянию базы."
        actions={
          <>
            <Link href="/pipeline" className={buttonClasses("primary")}>
              Открыть воронку
            </Link>
            <Link href="/leads" className={buttonClasses("secondary")}>
              Лиды
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </>
        }
      />

      {/* Ключевые показатели: компактные белые плитки на одной серой подложке. */}
      <section aria-label="Ключевые показатели" className="rounded-xl bg-block p-2">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {KPI_LABELS.map((label) => (
            <div key={label} className="flex flex-col gap-3 rounded-lg bg-card px-5 py-4">
              <p className="text-small text-ink-secondary">{label}</p>
              <p className="text-display tabular-nums text-ink-disabled" aria-label={`${label}: нет данных`}>
                —
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Аналитика: крупные блоки, левый шире — главная диаграмма. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        <Block title="Сделки по стадиям" action={<ArrowLink href="/pipeline">Воронка</ArrowLink>} className="xl:col-span-7">
          <EmptyState
            icon={ChartColumn}
            title="Диаграмма появится здесь"
            description="Количество и сумма сделок на каждой стадии воронки."
            className="min-h-80 flex-1"
          />
        </Block>
        <Block title="Статусы лидов" action={<ArrowLink href="/leads">Все лиды</ArrowLink>} className="xl:col-span-5">
          <EmptyState
            icon={ChartNoAxesColumn}
            title="Диаграмма появится здесь"
            description="Распределение лидов по пяти статусам."
            className="min-h-80 flex-1"
          />
        </Block>
      </div>

      {/* Сводки и списки: лёгкие секции без подложки. */}
      <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2">
        {SECTIONS.map((title) => (
          <Section key={title} title={title}>
            <p className="text-body text-ink-secondary">Пока нет данных.</p>
          </Section>
        ))}
      </div>
    </>
  );
}
