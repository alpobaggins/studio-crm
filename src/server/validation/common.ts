import { z } from "zod";

// Пустые строки из формы считаются «не указано».
const blankToUndefined = (value: unknown) => {
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
