import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { DealFilters } from "@/server/validation/deal";

/**
 * Условие выборки по фильтрам списка (Plan.md 1.4): стадия — `stageId`, статус — `stage.type`.
 * Фильтры независимы и сочетаются через AND; поиск — по названию, компании и контакту без учёта регистра.
 */
export function dealWhere({ q, status, stage }: DealFilters): Prisma.OpportunityWhereInput {
  const where: Prisma.OpportunityWhereInput = {};
  if (stage) where.stageId = stage;
  if (status) where.stage = { type: status };
  if (q) {
    const contains = { contains: q, mode: "insensitive" } as const;
    where.OR = [{ name: contains }, { account: { name: contains } }, { contact: { fullName: contains } }];
  }
  return where;
}

export async function listDeals(filters: DealFilters) {
  const deals = await prisma.opportunity.findMany({
    where: dealWhere(filters),
    orderBy: [{ stage: { order: "asc" } }, { createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      amount: true,
      eventDate: true,
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, fullName: true } },
      stage: { select: { id: true, name: true, type: true } },
    },
  });
  // Decimal не передаётся дальше сервера в виде объекта (Plan.md 3).
  return deals.map((deal) => ({ ...deal, amount: deal.amount?.toString() ?? null }));
}

export async function getDeal(id: string) {
  const deal = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, name: true, industry: true, city: true } },
      // Собственная компания контакта: она может отличаться от компании сделки (DESIGN.md, «Карточка сущности»).
      contact: { select: { id: true, fullName: true, position: true, account: { select: { id: true, name: true } } } },
      stage: { select: { id: true, name: true, type: true } },
      // Лид, при конвертации которого создана сделка (Lead.convertedOpportunity).
      convertedLeads: { orderBy: { createdAt: "asc" }, select: { id: true, contactName: true } },
    },
  });
  return deal && { ...deal, amount: deal.amount?.toString() ?? null };
}

/** Справочник стадий по порядку воронки. */
export function listStages() {
  return prisma.stage.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, type: true } });
}

/**
 * Доска воронки: все шесть стадий по порядку (пустые тоже), сделки каждой стадии, количество и сумма.
 * Количество и сумма считаются в базе через `groupBy`; пустая сумма сделки в итог не входит (как 0).
 * Порядок карточек в колонке не хранится: новые сверху.
 */
export async function getPipeline() {
  const [stages, deals, totals] = await Promise.all([
    listStages(),
    prisma.opportunity.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        stageId: true,
        amount: true,
        contactId: true,
        account: { select: { name: true } },
        contact: { select: { fullName: true } },
      },
    }),
    prisma.opportunity.groupBy({ by: ["stageId"], _count: { _all: true }, _sum: { amount: true } }),
  ]);
  return stages.map((stage) => {
    const total = totals.find((row) => row.stageId === stage.id);
    return {
      ...stage,
      count: total?._count._all ?? 0,
      sum: total?._sum.amount?.toString() ?? "0",
      deals: deals
        .filter((deal) => deal.stageId === stage.id)
        .map((deal) => ({ ...deal, amount: deal.amount?.toString() ?? null })),
    };
  });
}

export type PipelineColumn = Awaited<ReturnType<typeof getPipeline>>[number];
export type PipelineDeal = PipelineColumn["deals"][number];

/** Сделки компании или контакта для карточки — связи независимы (Plan.md 1.5). */
export async function listRelatedDeals(where: { accountId: string } | { contactId: string }) {
  const deals = await prisma.opportunity.findMany({
    where,
    orderBy: [{ stage: { order: "asc" } }, { createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      amount: true,
      account: { select: { name: true } },
      stage: { select: { name: true, type: true } },
    },
  });
  return deals.map((deal) => ({ ...deal, amount: deal.amount?.toString() ?? null }));
}
