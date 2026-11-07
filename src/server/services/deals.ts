// Бизнес-правила сделок (Plan.md 1.4, 1.5, 1.8). Без зависимостей от Next.js — вызываются из actions и тестов.
import { Prisma, type StageType } from "@prisma/client";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { deleteConsequences } from "@/lib/format";
import type { DealCreateInput, DealStageChangeInput, DealUpdateInput } from "@/server/validation/deal";

const FIELDS_MESSAGE = "Проверьте выделенные поля.";
const NOT_FOUND_MESSAGE = "Запись не найдена — возможно, её уже удалили.";
export const OPEN_STAGE_ONLY_MESSAGE =
  "Новая сделка создаётся в открытой стадии. «Выиграна» и «Проиграна» выбираются позже, при смене стадии.";
export const WON_AMOUNT_MESSAGE = "У выигранной сделки сумма должна быть больше нуля";
export const WON_CONTACT_MESSAGE = "У выигранной сделки должен быть указан контакт";
export const LOST_REASON_MESSAGE = "Укажите причину проигрыша";
export const STAGE_CHANGED_MESSAGE =
  "Стадию сделки только что изменили. Обновите страницу и проверьте данные перед сохранением.";

/** Поля, от которых зависят правила закрытых стадий. Сумма — строка Decimal. */
type StageRuleFields = { amount?: string | null; contactId?: string | null; lostReason?: string | null };

/**
 * Чего требует тип стадии от сделки (Plan.md 1.5): `won` — сумма больше нуля и контакт, `lost` — причина.
 * Возвращает ошибки по полям; пустой объект — правила выполнены. Сравнение суммы — через Decimal, без округления.
 */
export function stageRuleErrors(type: StageType, deal: StageRuleFields): Record<string, string> {
  const errors: Record<string, string> = {};
  if (type === "won") {
    if (!deal.amount || !new Prisma.Decimal(deal.amount).greaterThan(0)) errors.amount = WON_AMOUNT_MESSAGE;
    if (!deal.contactId) errors.contactId = WON_CONTACT_MESSAGE;
  }
  if (type === "lost" && !deal.lostReason?.trim()) errors.lostReason = LOST_REASON_MESSAGE;
  return errors;
}

/** Компания обязательна и должна существовать; контакт необязателен и может быть из любой компании или без неё. */
async function linkErrors(accountId: string, contactId: string | undefined): Promise<Record<string, string>> {
  const [account, contact] = await Promise.all([
    prisma.account.count({ where: { id: accountId } }),
    contactId ? prisma.contact.count({ where: { id: contactId } }) : 1,
  ]);
  const errors: Record<string, string> = {};
  if (!account) errors.accountId = "Выбранная компания не найдена — возможно, её удалили.";
  if (!contact) errors.contactId = "Выбранный контакт не найден — возможно, его удалили.";
  return errors;
}

function commonData(input: DealCreateInput | DealUpdateInput) {
  return {
    name: input.name,
    accountId: input.accountId,
    contactId: input.contactId ?? null,
    amount: input.amount ?? null,
    venue: input.venue ?? null,
    eventDate: input.eventDate ?? null,
    workFormat: input.workFormat ?? null,
    expectedCloseDate: input.expectedCloseDate ?? null,
    comment: input.comment ?? null,
  };
}

/** Создаёт сделку. Только в открытой стадии (Plan.md 1.5), поэтому причина проигрыша и дата закрытия пусты. */
export async function createDeal(input: DealCreateInput): Promise<{ id: string }> {
  const [stage, links] = await Promise.all([
    prisma.stage.findUnique({ where: { id: input.stageId }, select: { type: true } }),
    linkErrors(input.accountId, input.contactId),
  ]);
  const errors = { ...links };
  if (!stage) errors.stageId = "Выбранная стадия не найдена.";
  else if (stage.type !== "open") errors.stageId = OPEN_STAGE_ONLY_MESSAGE;
  if (Object.keys(errors).length) throw new DomainError(FIELDS_MESSAGE, errors);

  return prisma.opportunity.create({
    data: { ...commonData(input), stageId: input.stageId, lostReason: null, closedAt: null },
    select: { id: true },
  });
}

/**
 * Изменяет поля сделки, не меняя стадию. Инварианты закрытых сделок (Plan.md 1.5): у выигранной нельзя
 * очистить сумму или контакт, у проигранной — причину. У незакрытой в `lost` сделки причина всегда пуста.
 *
 * Стадия входит в условие UPDATE: если её успели сменить после проверки правил, запись не изменится.
 */
export async function updateDeal(id: string, input: DealUpdateInput): Promise<void> {
  const current = await prisma.opportunity.findUnique({
    where: { id },
    select: { stageId: true, stage: { select: { type: true } } },
  });
  if (!current) throw new DomainError(NOT_FOUND_MESSAGE);

  const type = current.stage.type;
  const lostReason = type === "lost" ? (input.lostReason ?? null) : null;
  const ruleErrors = stageRuleErrors(type, { amount: input.amount, contactId: input.contactId, lostReason });
  const errors = { ...(await linkErrors(input.accountId, input.contactId)), ...ruleErrors };
  if (Object.keys(errors).length) {
    const message =
      ruleErrors.amount || ruleErrors.contactId
        ? "Сделка выиграна: у неё должны остаться сумма больше нуля и контакт."
        : ruleErrors.lostReason
          ? "Сделка проиграна: причина проигрыша обязательна."
          : FIELDS_MESSAGE;
    throw new DomainError(message, errors);
  }

  const { count } = await prisma.opportunity.updateMany({
    where: { id, stageId: current.stageId },
    data: { ...commonData(input), lostReason },
  });
  if (count === 1) return;

  const exists = await prisma.opportunity.count({ where: { id } });
  throw new DomainError(exists ? STAGE_CHANGED_MESSAGE : NOT_FOUND_MESSAGE);
}

export const STAGE_NOT_FOUND_MESSAGE = "Выбранная стадия не найдена.";
export const SAME_STAGE_MESSAGE = "Сделка уже в этой стадии.";

/** Сообщение об отказе закрыть сделку: что именно нужно указать (DESIGN.md 7, «Тон»). */
function closeRefusalMessage(errors: Record<string, string>): string {
  if (errors.lostReason) return "Нельзя закрыть сделку как проигранную: укажите причину проигрыша.";
  const missing = [errors.amount && "сумму больше нуля", errors.contactId && "контакт"].filter(Boolean);
  return `Нельзя закрыть сделку как выигранную: укажите ${missing.join(" и ")}.`;
}

/**
 * Единственная серверная операция смены стадии (Plan.md 1.5). Её вызывают карточка сделки, Kanban
 * и быстрые действия. Правила целевой стадии — `stageRuleErrors`, те же, что у формы изменения.
 *
 * | Переход               | Проверка                        | Запись                                      |
 * | открытая → открытая   | —                               | только стадия                               |
 * | любая → `won`         | сумма > 0 и контакт             | `closedAt = now`, `lostReason = null`       |
 * | любая → `lost`        | причина не пустая после trim    | `closedAt = now`, причина сохраняется       |
 * | закрытая → открытая   | подтверждение — в интерфейсе    | `closedAt = null`, `lostReason = null`      |
 *
 * Для `won` можно сразу дополнить сделку суммой и контактом из диалога; без них берутся текущие значения.
 *
 * Защита от устаревших данных и гонок — условный `updateMany`:
 * - `stageId = fromStageId`: если стадию уже сменили (другая вкладка, двойной перенос), запись не изменится;
 * - для `won` без новых значений — ещё и `amount > 0`, `contactId IS NOT NULL`: если форма изменения
 *   успела очистить сумму или контакт после проверки, сделка не закроется с нарушением правила.
 */
export async function changeDealStage(id: string, input: DealStageChangeInput): Promise<{ stageName: string }> {
  const [deal, target] = await Promise.all([
    prisma.opportunity.findUnique({
      where: { id },
      select: { stageId: true, amount: true, contactId: true },
    }),
    prisma.stage.findUnique({ where: { id: input.stageId }, select: { id: true, name: true, type: true } }),
  ]);
  if (!deal) throw new DomainError(NOT_FOUND_MESSAGE);
  if (!target) throw new DomainError(STAGE_NOT_FOUND_MESSAGE, { stageId: STAGE_NOT_FOUND_MESSAGE });
  if (deal.stageId !== input.fromStageId) throw new DomainError(STAGE_CHANGED_MESSAGE);
  if (deal.stageId === target.id) throw new DomainError(SAME_STAGE_MESSAGE, { stageId: SAME_STAGE_MESSAGE });

  // Сумма и контакт из диалога учитываются только при выигрыше; иначе стадия не трогает эти поля.
  const isWon = target.type === "won";
  const amount = isWon && input.amount !== undefined ? input.amount : (deal.amount?.toString() ?? null);
  const contactId = isWon && input.contactId !== undefined ? input.contactId : deal.contactId;
  const lostReason = target.type === "lost" ? (input.lostReason?.trim() ?? null) : null;

  const errors = stageRuleErrors(target.type, { amount, contactId, lostReason });
  if (Object.keys(errors).length) throw new DomainError(closeRefusalMessage(errors), errors);
  if (isWon && input.contactId !== undefined && !(await prisma.contact.count({ where: { id: input.contactId } }))) {
    throw new DomainError(FIELDS_MESSAGE, { contactId: "Выбранный контакт не найден — возможно, его удалили." });
  }

  const where: Prisma.OpportunityWhereInput = { id, stageId: input.fromStageId };
  if (isWon && input.amount === undefined) where.amount = { gt: 0 };
  if (isWon && input.contactId === undefined) where.contactId = { not: null };

  const data: Prisma.OpportunityUncheckedUpdateManyInput = {
    stageId: target.id,
    closedAt: target.type === "open" ? null : new Date(),
    lostReason,
  };
  if (isWon) Object.assign(data, { amount, contactId });

  const { count } = await prisma.opportunity.updateMany({ where, data });
  if (count === 1) return { stageName: target.name };

  // Ничего не обновлено: сделку удалили, сменили стадию или очистили сумму/контакт после проверки.
  const now = await prisma.opportunity.findUnique({ where: { id }, select: { stageId: true } });
  if (!now) throw new DomainError(NOT_FOUND_MESSAGE);
  if (now.stageId !== input.fromStageId) throw new DomainError(STAGE_CHANGED_MESSAGE);
  throw new DomainError("Данные сделки только что изменили. Обновите страницу и попробуйте ещё раз.");
}

export type DealDeleteImpact = {
  activities: number;
  /** Удаление сделки ничем не блокируется (Plan.md 1.8); поле оставлено для единого вида диалога. */
  blockedReason: null;
  /** Что произойдёт при удалении — текст для диалога подтверждения. */
  consequences: string;
};

export async function getDealDeleteImpact(id: string): Promise<DealDeleteImpact> {
  const [activities, convertedLeads] = await Promise.all([
    prisma.activity.count({ where: { opportunityId: id } }),
    prisma.lead.count({ where: { convertedOpportunityId: id } }),
  ]);
  const consequences =
    "Компания и контакт сделки останутся. " +
    (convertedLeads > 0 ? "Лид, из которого создана сделка, останется конвертированным. " : "") +
    deleteConsequences("со сделкой", activities);
  return { activities, blockedReason: null, consequences };
}

/**
 * Удаляет сделку. Её активности удаляются каскадно, ссылка конвертированного лида очищается (SetNull),
 * компания и контакт не затрагиваются (Plan.md 1.8). Блокирующих связей у сделки нет.
 */
export async function deleteDeal(id: string): Promise<void> {
  await prisma.opportunity.delete({ where: { id } });
}
