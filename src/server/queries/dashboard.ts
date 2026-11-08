import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/leads";
import { prisma } from "@/server/db";
import { overdueTaskWhere } from "@/server/queries/activities";
import { listStages } from "@/server/queries/deals";

/** Сколько задач показывать в списке «Просроченные задачи»; общее число — в KPI. */
export const OVERDUE_LIST_LIMIT = 10;

/**
 * Показатели дашборда (Plan.md 1.10) по текущему состоянию базы. Подсчёты — в PostgreSQL через
 * `aggregate` и `groupBy`; нулевые группы дополняются из справочника стадий и enum статусов и источников.
 * Суммы — строки Decimal без потери точности (Plan.md 3); пустая сумма сделки в итог не входит.
 * today — сегодняшняя дата в APP_TIME_ZONE (`getAppToday()` в компонентах, `todayInTimeZone` в тестах).
 */
export async function getDashboardData(today: Date) {
  const [leads, openDeals, overdue, stages, byStage, byStatus, bySource, recentLeads, overdueTasks] = await Promise.all([
    prisma.lead.aggregate({ _count: { _all: true } }),
    prisma.opportunity.aggregate({ where: { stage: { type: "open" } }, _count: { _all: true }, _sum: { amount: true } }),
    prisma.activity.aggregate({ where: overdueTaskWhere(today), _count: { _all: true } }),
    listStages(),
    prisma.opportunity.groupBy({ by: ["stageId"], _count: { _all: true }, _sum: { amount: true } }),
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.lead.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 5,
      select: { id: true, contactName: true, companyName: true, source: true, status: true, createdAt: true },
    }),
    prisma.activity.findMany({
      where: overdueTaskWhere(today),
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: OVERDUE_LIST_LIMIT,
      select: {
        id: true,
        body: true,
        dueDate: true,
        lead: { select: { id: true, contactName: true } },
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true } },
        opportunity: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    kpi: {
      leads: leads._count._all,
      openDeals: openDeals._count._all,
      openSum: openDeals._sum.amount?.toString() ?? "0",
      overdueTasks: overdue._count._all,
    },
    stages: stages.map((stage) => {
      const row = byStage.find((r) => r.stageId === stage.id);
      return {
        id: stage.id,
        name: stage.name,
        type: stage.type,
        count: row?._count._all ?? 0,
        sum: row?._sum.amount?.toString() ?? "0",
      };
    }),
    leadStatuses: LEAD_STATUSES.map((status) => ({
      status,
      count: byStatus.find((r) => r.status === status)?._count._all ?? 0,
    })),
    leadSources: LEAD_SOURCES.map((source) => ({
      source,
      count: bySource.find((r) => r.source === source)?._count._all ?? 0,
    })),
    recentLeads,
    overdueTasks: overdueTasks.map(({ lead, account, contact, opportunity, ...task }) => ({
      ...task,
      // Родитель ровно один (CHECK в миграции).
      parent: opportunity
        ? { kind: "Сделка", name: opportunity.name, href: `/deals/${opportunity.id}` }
        : lead
          ? { kind: "Лид", name: lead.contactName, href: `/leads/${lead.id}` }
          : contact
            ? { kind: "Контакт", name: contact.fullName, href: `/contacts/${contact.id}` }
            : account
              ? { kind: "Компания", name: account.name, href: `/accounts/${account.id}` }
              : null,
    })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
