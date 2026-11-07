import { z } from "zod";
import { STAGE_TYPES } from "@/lib/deals";
import { blankToUndefined, optionalDate, optionalId, optionalMoney, optionalText, requiredText } from "./common";

const dealFields = {
  name: requiredText("Укажите название сделки"),
  accountId: z.preprocess(blankToUndefined, z.string({ error: "Выберите компанию" })),
  // Необязателен и не зависит от компании сделки (Plan.md 1.5).
  contactId: optionalId,
  amount: optionalMoney("Сумма: число в рублях, например 1500000 или 1500000,50"),
  venue: optionalText(),
  eventDate: optionalDate,
  workFormat: optionalText(),
  expectedCloseDate: optionalDate,
  comment: optionalText(2000),
};

/**
 * Создание: стадия обязательна. То, что она открытая, проверяет сервис —
 * правило должно действовать при любом вызове, а не только из формы.
 */
export const dealCreateSchema = z.object({
  ...dealFields,
  stageId: z.preprocess(blankToUndefined, z.string({ error: "Выберите стадию" })),
});

/**
 * Изменение: стадии в форме нет (Plan.md 1.5) — поле `stageId`, даже если его прислать, отбрасывается.
 * Причина проигрыша принимается всегда, а сохраняется только у сделки в стадии `lost`.
 */
export const dealUpdateSchema = z.object({
  ...dealFields,
  lostReason: optionalText(500),
});

export type DealCreateInput = z.infer<typeof dealCreateSchema>;
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>;

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);

/** Фильтры списка из searchParams. Неизвестные значения игнорируются, а не ломают страницу. */
export const dealFiltersSchema = z.object({
  q: z.preprocess(firstValue, z.string().trim().max(200).optional().catch(undefined)),
  status: z.preprocess(firstValue, z.enum(STAGE_TYPES).optional().catch(undefined)),
  // Существование стадии проверяет страница по справочнику; здесь — только форма значения.
  stage: z.preprocess(firstValue, z.string().regex(/^[a-z0-9_]{1,50}$/).optional().catch(undefined)),
});

export type DealFilters = z.infer<typeof dealFiltersSchema>;

export function parseDealFilters(searchParams: Record<string, string | string[] | undefined>): DealFilters {
  const filters = dealFiltersSchema.parse(searchParams);
  return { ...filters, q: filters.q || undefined };
}
