/**
 * Результат Server Action для форм (Plan.md, раздел 3). Успех — это redirect,
 * поэтому состояние описывает только ошибку и введённые значения для повторного показа.
 */
export type FormState = {
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

export const EMPTY_FORM_STATE: FormState = {};

/** Значения формы как строки — чтобы вернуть их в поля после ошибки. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}
