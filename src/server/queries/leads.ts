import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { LeadFilters } from "@/server/validation/lead";

/** Условие выборки по фильтрам списка: все фильтры сочетаются через AND, поиск — без учёта регистра. */
export function leadWhere({ q, status, source }: LeadFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  if (status) where.status = status;
  if (source) where.source = source;
  if (q) {
    where.OR = (["contactName", "companyName", "email", "phone"] as const).map((field) => ({
      [field]: { contains: q, mode: "insensitive" },
    }));
  }
  return where;
}

export async function listLeads(filters: LeadFilters) {
  const leads = await prisma.lead.findMany({
    where: leadWhere(filters),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      contactName: true,
      companyName: true,
      email: true,
      phone: true,
      source: true,
      status: true,
      budget: true,
      createdAt: true,
    },
  });
  // Decimal не передаётся дальше сервера в виде объекта (Plan.md 3).
  return leads.map((lead) => ({ ...lead, budget: lead.budget?.toString() ?? null }));
}

export async function getLead(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      convertedAccount: { select: { id: true, name: true } },
      convertedContact: { select: { id: true, fullName: true } },
      convertedOpportunity: { select: { id: true, name: true } },
    },
  });
  return lead && { ...lead, budget: lead.budget?.toString() ?? null };
}

/** Сколько активностей перейдёт к сделке или контакту при конвертации. */
export function countLeadActivities(leadId: string) {
  return prisma.activity.count({ where: { leadId } });
}
