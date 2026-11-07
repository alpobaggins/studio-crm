// Бизнес-правила лидов (Plan.md 1.3, 1.8). Без зависимостей от Next.js — вызываются из actions и тестов.
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { deleteConsequences } from "@/lib/format";
import { isEditableLeadStatus } from "@/lib/leads";
import type { LeadInput } from "@/server/validation/lead";

const NOT_FOUND_MESSAGE = "Запись не найдена — возможно, её уже удалили.";
export const CONVERTED_LEAD_READONLY_MESSAGE =
  "Конвертированный лид нельзя изменить: его данные уже перенесены в контакт и компанию.";

/**
 * Статус `converted` ставит только транзакция конвертации (шаг 10). Схема Zod его уже отклоняет,
 * но правило живёт в сервисе, чтобы его нельзя было обойти другим вызовом.
 */
function assertEditableStatus(status: unknown) {
  if (status !== undefined && !isEditableLeadStatus(status)) {
    throw new DomainError("Проверьте выделенные поля.", {
      status: "Статус «Конвертирован» ставится только при конвертации лида",
    });
  }
}

function toData(input: LeadInput) {
  return {
    contactName: input.contactName,
    companyName: input.companyName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    source: input.source,
    budget: input.budget ?? null,
    venue: input.venue ?? null,
    eventDate: input.eventDate ?? null,
    workFormat: input.workFormat ?? null,
    comment: input.comment ?? null,
  };
}

export async function createLead(input: LeadInput): Promise<{ id: string }> {
  assertEditableStatus(input.status);
  return prisma.lead.create({
    data: { ...toData(input), status: input.status ?? "new" },
    select: { id: true },
  });
}

/**
 * Изменяет лид, если он ещё не конвертирован. Условие на статус входит в сам UPDATE,
 * поэтому параллельная конвертация не может «проскочить» между проверкой и записью.
 * Без статуса во входных данных статус не меняется.
 */
export async function updateLead(id: string, input: LeadInput): Promise<void> {
  assertEditableStatus(input.status);
  const { count } = await prisma.lead.updateMany({
    where: { id, status: { not: "converted" } },
    data: { ...toData(input), ...(input.status ? { status: input.status } : {}) },
  });
  if (count === 1) return;

  const exists = await prisma.lead.count({ where: { id } });
  throw new DomainError(exists ? CONVERTED_LEAD_READONLY_MESSAGE : NOT_FOUND_MESSAGE);
}

export type LeadDeleteImpact = {
  activities: number;
  /** Удаление лида ничем не блокируется (Plan.md 1.8); поле оставлено для единого вида диалога. */
  blockedReason: null;
  /** Что произойдёт при удалении — текст для диалога подтверждения. */
  consequences: string;
};

export async function getLeadDeleteImpact(id: string): Promise<LeadDeleteImpact> {
  const [activities, lead] = await Promise.all([
    prisma.activity.count({ where: { leadId: id } }),
    prisma.lead.findUnique({ where: { id }, select: { status: true } }),
  ]);
  const consequences =
    (lead?.status === "converted"
      ? "Компания, контакт и сделка, созданные при конвертации, останутся. "
      : "") + deleteConsequences("с лидом", activities);
  return { activities, blockedReason: null, consequences };
}

/**
 * Удаляет лид любого статуса. Его активности удаляются каскадно;
 * созданные из него компания, контакт и сделка не затрагиваются (Plan.md 1.8).
 */
export async function deleteLead(id: string): Promise<void> {
  await prisma.lead.delete({ where: { id } });
}
