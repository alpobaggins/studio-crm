import { z } from "zod";

// Пустые строки из формы считаются «не указано».
export const blankToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export const requiredText = (emptyMessage: string, max = 200) =>
  z.preprocess(
    blankToUndefined,
    z.string({ error: emptyMessage }).max(max, `Не длиннее ${max} символов`),
  );

export const optionalText = (max = 200) =>
  z.preprocess(blankToUndefined, z.string().max(max, `Не длиннее ${max} символов`).optional());

export const optionalEmail = z.preprocess(
  blankToUndefined,
  z.email({ error: "Проверьте email: например, name@company.ru" }).max(200).optional(),
);

export const optionalPhone = z.preprocess(
  blankToUndefined,
  z
    .string()
    .max(40, "Не длиннее 40 символов")
    .regex(/^\+?[\d\s()-]{5,}$/, "Телефон: цифры, пробелы, скобки, дефис и «+» в начале")
    .optional(),
);

/**
 * Денежная сумма в рублях для `Decimal(14, 2)`: пробелы между разрядами и запятая допустимы;
 * до 12 цифр и 2 знаков после запятой. Результат — строка: Prisma принимает её как Decimal без потери копеек.
 */
export const optionalMoney = (formatMessage: string) =>
  z.preprocess(
    (value) => {
      const text = blankToUndefined(value);
      return typeof text === "string" ? text.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".") : text;
    },
    z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, formatMessage).optional(),
  );

/** Дата без времени из `<input type="date">` → Date на полночь UTC (как хранится `@db.Date`). */
export const optionalDate = z.preprocess(
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

export const optionalId = z.preprocess(blankToUndefined, z.string().optional());

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: Record<string, string> };

/** Разбирает FormData схемой Zod; для каждого поля возвращает первую ошибку. */
export function parseForm<T>(schema: z.ZodType<T>, formData: FormData): ParseResult<T> {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, fieldErrors };
}
