import { prisma } from "@/server/db";
import { dealWhere } from "@/server/queries/deals";
import { leadWhere } from "@/server/queries/leads";

/** Сколько записей каждого типа показывать; одна лишняя запрашивается, чтобы знать, что есть ещё. */
export const SEARCH_LIMIT = 10;

const containsAny = (q: string, fields: readonly string[]) =>
  fields.map((field) => ({ [field]: { contains: q, mode: "insensitive" as const } }));

/**
 * Глобальный поиск (Plan.md, шаг 09): четыре обычных запроса Prisma без индекса и ранжирования,
 * `contains` + `insensitive`. Лиды и сделки ищутся теми же условиями, что и поиск в их списках.
 */
export async function searchCrm(q: string) {
  const take = SEARCH_LIMIT + 1;
  const [leads, accounts, contacts, deals] = await Promise.all([
    prisma.lead.findMany({
      where: leadWhere({ q }),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take,
      select: { id: true, contactName: true, companyName: true, status: true },
    }),
    prisma.account.findMany({
      where: { OR: containsAny(q, ["name", "email", "phone"]) },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take,
      select: { id: true, name: true, industry: true, city: true },
    }),
    prisma.contact.findMany({
      where: { OR: containsAny(q, ["fullName", "email", "phone"]) },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      take,
      select: { id: true, fullName: true, position: true, account: { select: { name: true } } },
    }),
    prisma.opportunity.findMany({
      where: dealWhere({ q }),
      orderBy: [{ stage: { order: "asc" } }, { createdAt: "desc" }, { id: "asc" }],
      take,
      select: { id: true, name: true, account: { select: { name: true } }, stage: { select: { name: true, type: true } } },
    }),
  ]);
  const group = <T,>(rows: T[]) => ({ items: rows.slice(0, SEARCH_LIMIT), hasMore: rows.length > SEARCH_LIMIT });
  return { leads: group(leads), accounts: group(accounts), contacts: group(contacts), deals: group(deals) };
}
