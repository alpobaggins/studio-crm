import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ChartColumn, ChartNoAxesColumn } from "lucide-react";
import { BarChart, type BarTone } from "@/components/dashboard/bar-chart";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { PageHeader } from "@/components/shell/page-header";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Block } from "@/components/ui/block";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeDueLabel } from "@/lib/activities";
import { formatDate, formatMoney, formatShortDateInZone, pluralRu } from "@/lib/format";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/lib/leads";
import { getDashboardData, type DashboardData } from "@/server/queries/dashboard";
import { getAppToday } from "@/server/today";

export const metadata: Metadata = { title: "Дашборд" };

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
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

// Показатели считаются в базе при каждом запросе (Plan.md 1.10); после мутаций actions вызывают revalidatePath("/dashboard").
async function DashboardContent() {
  const { today, timeZone } = await getAppToday();
  const data = await getDashboardData(today);
  const { kpi } = data;
  const linkClasses = "rounded-sm hover:text-accent hover:underline hover:underline-offset-4";

  return (
    <>
      {/* Ключевые показатели: белые плитки на одной серой подложке; вся плитка — ссылка (DESIGN.md 5). */}
      <section aria-label="Ключевые показатели" className="rounded-xl bg-block p-2">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <KpiTile label="Всего лидов" value={String(kpi.leads)} href="/leads" />
          <KpiTile label="Открытых сделок" value={String(kpi.openDeals)} href="/deals?status=open" />
          {/* На узком экране знак ₽ может перейти на вторую строку: число не переносится и не обрезается. */}
          <KpiTile label="Сумма открытых сделок" value={formatMoney(kpi.openSum).replace(/\s₽$/, " ₽")} href="/deals?status=open" />
          <KpiTile label="Просроченных задач" value={String(kpi.overdueTasks)} href="#overdue-tasks" />
        </div>
      </section>

      {/* Аналитика: левый блок шире — главная диаграмма. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        <Block title="Сделки по стадиям" action={<ArrowLink href="/pipeline">Воронка</ArrowLink>} className="min-w-0 xl:col-span-7">
          <StageChart stages={data.stages} />
        </Block>
        <Block title="Статусы лидов" action={<ArrowLink href="/leads">Все лиды</ArrowLink>} className="min-w-0 xl:col-span-5">
          <LeadStatusChart statuses={data.leadStatuses} />
        </Block>
      </div>

      {/* Сводки и списки: лёгкие секции без подложки; сводки — текстовая альтернатива диаграммам. */}
      <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2">
        <Section title="Сводка по статусам лидов">
          <Summary
            rows={data.leadStatuses.map((s) => ({ label: LEAD_STATUS_LABELS[s.status], count: s.count, href: `/leads?status=${s.status}` }))}
          />
        </Section>
        <Section title="Сводка по источникам лидов">
          <Summary
            rows={data.leadSources.map((s) => ({ label: LEAD_SOURCE_LABELS[s.source], count: s.count, href: `/leads?source=${s.source}` }))}
          />
        </Section>

        <Section title="Новые лиды" action={<ArrowLink href="/leads">Все лиды</ArrowLink>}>
          {data.recentLeads.length === 0 ? (
            <p className="text-body text-ink-secondary">Лидов пока нет.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {data.recentLeads.map((lead) => (
                <li key={lead.id} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                  <div className="min-w-0">
                    <Link href={`/leads/${lead.id}`} className={`text-body font-medium ${linkClasses}`}>
                      {lead.contactName}
                    </Link>
                    <p className="truncate text-small text-ink-secondary">
                      {[lead.companyName, LEAD_SOURCE_LABELS[lead.source], formatShortDateInZone(lead.createdAt, timeZone)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <LeadStatusBadge status={lead.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div id="overdue-tasks" className="scroll-mt-6">
          <Section title="Просроченные задачи">
            {data.overdueTasks.length === 0 ? (
              <p className="text-body text-ink-secondary">Просроченных задач нет.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {data.overdueTasks.map((task) => (
                  <li key={task.id} className="flex flex-col gap-1 py-3 first:pt-0">
                    <p className="text-body">{task.body}</p>
                    <p className="text-small text-ink-secondary">
                      {task.parent && (
                        <>
                          {task.parent.kind}{" "}
                          <Link href={task.parent.href} className={`font-medium text-ink ${linkClasses}`}>
                            {task.parent.name}
                          </Link>
                          {" · "}
                        </>
                      )}
                      {task.dueDate && (
                        <>
                          срок {formatDate(task.dueDate)} ·{" "}
                          <span className="font-medium text-ink">{relativeDueLabel({ dueDate: task.dueDate, done: false }, today)}</span>
                        </>
                      )}
                    </p>
                  </li>
                ))}
                {kpi.overdueTasks > data.overdueTasks.length && (
                  <li className="pt-3 text-small text-ink-secondary">
                    Ещё {pluralRu(kpi.overdueTasks - data.overdueTasks.length, ["задача", "задачи", "задач"])} — в карточках записей.
                  </li>
                )}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function KpiTile({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-3 rounded-lg bg-card px-5 py-4 hover:bg-subtle">
      <span className="text-small text-ink-secondary group-hover:text-ink">{label}</span>
      {/* Длинная сумма уменьшается до 24 px, а не обрезается (DESIGN.md 5). */}
      <span className="text-display text-[length:clamp(1.5rem,0.9rem+1.6vw,2rem)] tabular-nums">{value}</span>
    </Link>
  );
}

function Summary({ rows }: { rows: { label: string; count: number; href: string }[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
          <Link href={row.href} className="rounded-sm text-body hover:text-accent hover:underline hover:underline-offset-4">
            {row.label}
          </Link>
          <span className="text-body font-medium tabular-nums">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}

const STAGE_TONE: Record<DashboardData["stages"][number]["type"], BarTone> = { open: "primary", won: "secondary", lost: "tertiary" };

function StageChart({ stages }: { stages: DashboardData["stages"] }) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return <EmptyState icon={ChartColumn} title="Сделок пока нет" description="Диаграмма появится, когда будет создана первая сделка." className="min-h-80 flex-1" />;
  }
  return (
    <div className="relative h-80 rounded-lg bg-card p-4">
      <BarChart
        labels={stages.map((s) => s.name)}
        values={stages.map((s) => s.count)}
        tones={stages.map((s) => STAGE_TONE[s.type])}
        tooltips={stages.map((s) => `${pluralRu(s.count, ["сделка", "сделки", "сделок"])} · ${formatMoney(s.sum)}`)}
        ariaLabel={`Сделки по стадиям, всего ${total}: ${stages.map((s) => `${s.name} — ${s.count}`).join(", ")}`}
      />
    </div>
  );
}

function LeadStatusChart({ statuses }: { statuses: DashboardData["leadStatuses"] }) {
  const total = statuses.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return <EmptyState icon={ChartNoAxesColumn} title="Лидов пока нет" description="Диаграмма появится, когда будет создан первый лид." className="min-h-80 flex-1" />;
  }
  return (
    <div className="relative h-80 rounded-lg bg-card p-4">
      <BarChart
        labels={statuses.map((s) => LEAD_STATUS_LABELS[s.status])}
        values={statuses.map((s) => s.count)}
        tooltips={statuses.map((s) => pluralRu(s.count, ["лид", "лида", "лидов"]))}
        ariaLabel={`Статусы лидов, всего ${total}: ${statuses.map((s) => `${LEAD_STATUS_LABELS[s.status]} — ${s.count}`).join(", ")}`}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Загрузка">
      <Skeleton className="h-28 rounded-xl" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        <Skeleton className="h-96 rounded-xl xl:col-span-7" />
        <Skeleton className="h-96 rounded-xl xl:col-span-5" />
      </div>
    </div>
  );
}
