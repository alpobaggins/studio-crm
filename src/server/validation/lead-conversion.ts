import { z } from "zod";
import { blankToUndefined, optionalEmail, optionalMoney, optionalPhone, requiredText } from "./common";

// Конвертация лида (Plan.md 1.6): контакт создаётся всегда, компания — новая или существующая,
// сделка — по выбору. Поля формы плоские; режимы компании и сделки — дискриминируемые объединения.

export const COMPANY_MODES = ["new", "existing"] as const;
export type CompanyMode = (typeof COMPANY_MODES)[number];

const EMAIL_OR_PHONE_MESSAGE = "Укажите телефон или email";

const hasEmailOrPhone = (contact: { email?: unknown; phone?: unknown }) => Boolean(contact.email || contact.phone);

/** Как в схеме лида: «email или телефон» проверяется, только если формат самих полей верен. */
const contactFieldsParsed = (payload: z.core.ParsePayload) =>
  !payload.issues.some((issue) => (issue.path?.[0] === "email" || issue.path?.[0] === "phone") && issue.code !== "custom");

const requiredId = (emptyMessage: string) => z.preprocess(blankToUndefined, z.string({ error: emptyMessage }).max(100));

const contactSchema = z
  .object({
    fullName: requiredText("Укажите имя контакта"),
    email: optionalEmail,
    phone: optionalPhone,
  })
  .refine(hasEmailOrPhone, { path: ["email"], message: EMAIL_OR_PHONE_MESSAGE, when: contactFieldsParsed })
  .refine(hasEmailOrPhone, { path: ["phone"], message: EMAIL_OR_PHONE_MESSAGE, when: contactFieldsParsed });

const companySchema = z.discriminatedUnion(
  "companyMode",
  [
    z.object({ companyMode: z.literal("new"), companyName: requiredText("Укажите название новой компании") }),
    z.object({ companyMode: z.literal("existing"), accountId: requiredId("Выберите компанию") }),
  ],
  { error: "Выберите: новая компания или существующая" },
);

const dealSchema = z.discriminatedUnion("createDeal", [
  z.object({ createDeal: z.literal(false) }),
  z.object({
    createDeal: z.literal(true),
    dealName: requiredText("Укажите название сделки"),
    // То, что стадия открытая, проверяет сервис внутри транзакции.
    stageId: requiredId("Выберите стадию"),
    amount: optionalMoney("Сумма: число в рублях, например 1500000 или 1500000,50"),
  }),
]);

/**
 * Схема формы конвертации. Ошибки контакта, компании и сделки собираются вместе:
 * пересечение разбирает все три части, даже если одна из них не прошла проверку.
 */
export const leadConversionSchema = z.preprocess(
  // Чекбокс формы присылает «on», когда отмечен, и ничего — когда нет.
  (value) => {
    if (typeof value !== "object" || value === null) return value;
    const flag = (value as { createDeal?: unknown }).createDeal;
    return { ...value, createDeal: flag === "on" || flag === "true" || flag === true };
  },
  z.intersection(contactSchema, z.intersection(companySchema, dealSchema)),
);

export type LeadConversionInput = z.infer<typeof leadConversionSchema>;
