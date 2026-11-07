// Значения enum лида и их русские подписи (Plan.md 1.2, 1.3). Без зависимостей от сервера — используется и в клиенте.
import type { LeadSource, LeadStatus } from "@prisma/client";

export const LEAD_SOURCES = ["site", "email", "phone", "referral", "manual"] as const satisfies readonly LeadSource[];

export const LEAD_STATUSES = [
  "new",
  "in_progress",
  "qualified",
  "disqualified",
  "converted",
] as const satisfies readonly LeadStatus[];

/** Статусы, которые можно выбрать в форме. `converted` ставит только транзакция конвертации (шаг 10). */
export const EDITABLE_LEAD_STATUSES = [
  "new",
  "in_progress",
  "qualified",
  "disqualified",
] as const satisfies readonly LeadStatus[];

export type EditableLeadStatus = (typeof EDITABLE_LEAD_STATUSES)[number];

/** Статусы, из которых лид можно конвертировать (Plan.md 1.3). */
export const CONVERTIBLE_LEAD_STATUSES: readonly LeadStatus[] = ["new", "in_progress", "qualified"];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  site: "Сайт",
  email: "Почта",
  phone: "Телефон",
  referral: "Рекомендация",
  manual: "Вручную",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новый",
  in_progress: "В работе",
  qualified: "Квалифицирован",
  disqualified: "Отклонён",
  converted: "Конвертирован",
};

export function isLeadSource(value: unknown): value is LeadSource {
  return typeof value === "string" && (LEAD_SOURCES as readonly string[]).includes(value);
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

export function isEditableLeadStatus(value: unknown): value is EditableLeadStatus {
  return typeof value === "string" && (EDITABLE_LEAD_STATUSES as readonly string[]).includes(value);
}
