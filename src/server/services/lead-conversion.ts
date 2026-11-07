// Конвертация лида (Plan.md 1.6). Без зависимостей от Next.js — вызывается из action и тестов.
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { CONVERTIBLE_LEAD_STATUSES } from "@/lib/leads";
import type { LeadConversionInput } from "@/server/validation/lead-conversion";

const FIELDS_MESSAGE = "Проверьте выделенные поля.";
export const LEAD_NOT_FOUND_MESSAGE = "Лид не найден — возможно, его уже удалили.";
export const ALREADY_CONVERTED_MESSAGE = "Лид уже конвертирован. Повторная конвертация невозможна.";
export const DISQUALIFIED_MESSAGE =
  "Отклонённый лид нельзя конвертировать. Сначала верните его в работу: измените статус.";
export const ACCOUNT_NOT_FOUND_MESSAGE = "Выбранная компания не найдена — возможно, её удалили.";
export const EMAIL_OR_PHONE_MESSAGE = "Укажите телефон или email";
export const OPEN_STAGE_MESSAGE = "Сделка при конвертации создаётся только в открытой стадии.";

export type LeadConversionResult = {
  accountId: string;
  contactId: string;
  opportunityId: string | null;
  /** Сколько активностей лида перенесено и куда. */
  movedActivities: number;
  activitiesMovedTo: "opportunity" | "contact";
};

/**
 * Правила, которые должны действовать при любом вызове, а не только после схемы Zod:
 * у контакта email или телефон, у новой компании название.
 */
function assertInput(input: LeadConversionInput) {
  const errors: Record<string, string> = {};
  if (!input.fullName?.trim()) errors.fullName = "Укажите имя контакта";
  if (!input.email?.trim() && !input.phone?.trim()) {
    errors.email = EMAIL_OR_PHONE_MESSAGE;
    errors.phone = EMAIL_OR_PHONE_MESSAGE;
  }
  if (input.companyMode === "new" && !input.companyName?.trim()) errors.companyName = "Укажите название новой компании";
  if (input.companyMode !== "new" && input.companyMode !== "existing") {
    errors.companyMode = "Выберите: новая компания или существующая";
  }
  if (input.createDeal && !input.dealName?.trim()) errors.dealName = "Укажите название сделки";
  if (Object.keys(errors).length) throw new DomainError(FIELDS_MESSAGE, errors);
}

/**
 * Конвертирует лид в одной интерактивной транзакции: либо применяются все изменения, либо ни одно.
 *
 * 1. Условный UPDATE лида в `converted` выполняется первым. Он блокирует строку лида до конца транзакции,
 *    поэтому параллельный вызов ждёт, а после фиксации первого PostgreSQL заново проверяет условие и
 *    обновляет 0 строк. Защита опирается на статус, а не на ссылки: ссылки обнуляются при удалении записей.
 * 2. Новая компания создаётся или проверяется существование выбранной.
 * 3. Создаётся контакт, связанный с этой компанией.
 * 4. По выбору создаётся сделка в открытой стадии, связанная с компанией и контактом.
 * 5. Активности лида переходят к сделке, а без неё — к контакту: у каждой остаётся ровно один родитель.
 * 6. В лиде сохраняются ссылки на созданные и связанные записи.
 *
 * Любая ошибка (в том числе DomainError) откатывает всё, включая статус лида.
 */
export async function convertLead(leadId: string, input: LeadConversionInput): Promise<LeadConversionResult> {
  assertInput(input);

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.lead.updateMany({
      where: { id: leadId, status: { in: [...CONVERTIBLE_LEAD_STATUSES] } },
      data: { status: "converted", convertedAt: new Date() },
    });
    if (count !== 1) {
      const current = await tx.lead.findUnique({ where: { id: leadId }, select: { status: true } });
      if (!current) throw new DomainError(LEAD_NOT_FOUND_MESSAGE);
      throw new DomainError(current.status === "converted" ? ALREADY_CONVERTED_MESSAGE : DISQUALIFIED_MESSAGE);
    }

    const lead = await tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      select: { venue: true, eventDate: true, workFormat: true },
    });

    let accountId: string;
    if (input.companyMode === "new") {
      ({ id: accountId } = await tx.account.create({ data: { name: input.companyName }, select: { id: true } }));
    } else {
      const account = await tx.account.findUnique({ where: { id: input.accountId }, select: { id: true } });
      if (!account) throw new DomainError(FIELDS_MESSAGE, { accountId: ACCOUNT_NOT_FOUND_MESSAGE });
      accountId = account.id;
    }

    const { id: contactId } = await tx.contact.create({
      data: { fullName: input.fullName, email: input.email ?? null, phone: input.phone ?? null, accountId },
      select: { id: true },
    });

    let opportunityId: string | null = null;
    if (input.createDeal) {
      const stage = await tx.stage.findUnique({ where: { id: input.stageId }, select: { type: true } });
      if (!stage) throw new DomainError(FIELDS_MESSAGE, { stageId: "Выбранная стадия не найдена." });
      if (stage.type !== "open") throw new DomainError(FIELDS_MESSAGE, { stageId: OPEN_STAGE_MESSAGE });
      ({ id: opportunityId } = await tx.opportunity.create({
        data: {
          name: input.dealName,
          accountId,
          contactId,
          stageId: input.stageId,
          amount: input.amount ?? null,
          // Данные мероприятия лида переходят в сделку без изменений: у сделки такие же поля.
          venue: lead.venue,
          eventDate: lead.eventDate,
          workFormat: lead.workFormat,
        },
        select: { id: true },
      }));
    }

    // Одним UPDATE: родитель меняется атомарно, CHECK «ровно один родитель» не нарушается.
    // Текст, срок и отметка выполнения не меняются.
    const { count: movedActivities } = await tx.activity.updateMany({
      where: { leadId },
      data: opportunityId ? { leadId: null, opportunityId } : { leadId: null, contactId },
    });

    await tx.lead.update({
      where: { id: leadId },
      data: { convertedAccountId: accountId, convertedContactId: contactId, convertedOpportunityId: opportunityId },
    });

    return {
      accountId,
      contactId,
      opportunityId,
      movedActivities,
      activitiesMovedTo: opportunityId ? "opportunity" : "contact",
    };
  });
}
