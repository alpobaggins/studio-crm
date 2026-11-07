import { z } from "zod";
import { EDITABLE_LEAD_STATUSES, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/leads";
import { blankToUndefined, optionalEmail, optionalPhone, optionalText, requiredText } from "./common";

/** Бюджет в рублях: пробелы между разрядами и запятая допустимы; до 12 цифр и 2 знаков после запятой (Decimal(14, 2)). */
const optionalBudget = z.preprocess(
  (value) => {
    const text = blankToUndefined(value);
    return typeof text === "string" ? text.replace(/[\s  ]/g, "").replace(",", ".") : text;
  },
  z
    .string()
    .regex(/^\d{1,12}(\.\d{1,2})?$/, "Бюджет: сумма в рублях, например 1500000 или 1500000,50")
    .optional(),
);

/** Дата без времени из `<input type="date">` → Date на полночь UTC (как хранится `@db.Date`). */
const optionalDate = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату в формате ДД.ММ.ГГГГ")
    .transform((value, ctx) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        ctx.addIssue({ code: "custom", message: "Такой даты нет — проверьте день и месяц" });
        return z.NEVER;
      }
      return date;
    })
    .optional(),
);

const EMAIL_OR_PHONE_MESSAGE = "Укажите телефон или email";

const hasEmailOrPhone = (lead: { email?: unknown; phone?: unknown }) => Boolean(lead.email || lead.phone);

/**
 * Проверять «email или телефон», только если сами поля email и телефон разобраны без ошибок формата.
 * Собственная ошибка этой проверки (`custom`) не мешает второй такой же проверке для соседнего поля.
 */
const contactFieldsParsed = (payload: z.core.ParsePayload) =>
  !payload.issues.some((issue) => (issue.path?.[0] === "email" || issue.path?.[0] === "phone") && issue.code !== "custom");

const CONVERTED_STATUS_MESSAGE ="Статус «Конвертирован» ставится только при конвертации лида";

export const leadSchema = z
  .object({
    contactName: requiredText("Укажите имя контакта"),
    companyName: optionalText(),
    email: optionalEmail,
    phone: optionalPhone,
    source: z.preprocess(
      blankToUndefined,
      z.enum(LEAD_SOURCES, { error: (issue) => (issue.input === undefined ? "Выберите источник" : "Выберите источник из списка") }),
    ),
    // Необязателен: при создании по умолчанию `new`, при изменении без статуса он не меняется.
    status: z.preprocess(
      blankToUndefined,
      z
        .enum(EDITABLE_LEAD_STATUSES, {
          error: (issue) => (issue.input === "converted" ? CONVERTED_STATUS_MESSAGE : "Выберите статус из списка"),
        })
        .optional(),
    ),
    budget: optionalBudget,
    venue: optionalText(),
    eventDate: optionalDate,
    workFormat: optionalText(),
    comment: optionalText(2000),
  })
  // Plan.md 2: у лида обязателен email или телефон. Ошибка показывается у обоих полей
  // и вместе с ошибками других полей, поэтому проверка идёт и при неудаче остальных (`when`).
  .refine(hasEmailOrPhone, { path: ["email"], message: EMAIL_OR_PHONE_MESSAGE, when: contactFieldsParsed })
  .refine(hasEmailOrPhone, { path: ["phone"], message: EMAIL_OR_PHONE_MESSAGE, when: contactFieldsParsed });

export type LeadInput = z.infer<typeof leadSchema>;

/** Фильтры списка из searchParams. Неизвестные значения игнорируются, а не ломают страницу. */
export const leadFiltersSchema = z.object({
  q: z.preprocess(
    (value) => (Array.isArray(value) ? value[0] : value),
    z.string().trim().max(200).optional().catch(undefined),
  ),
  status: z.preprocess((value) => (Array.isArray(value) ? value[0] : value), z.enum(LEAD_STATUSES).optional().catch(undefined)),
  source: z.preprocess((value) => (Array.isArray(value) ? value[0] : value), z.enum(LEAD_SOURCES).optional().catch(undefined)),
});

export type LeadFilters = z.infer<typeof leadFiltersSchema>;

export function parseLeadFilters(searchParams: Record<string, string | string[] | undefined>): LeadFilters {
  const filters = leadFiltersSchema.parse(searchParams);
  return { ...filters, q: filters.q || undefined };
}
