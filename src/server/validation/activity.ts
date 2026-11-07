import { z } from "zod";
import { blankToUndefined, optionalDate, requiredText } from "./common";

export const ACTIVITY_BODY_MAX = 2000;
export const BODY_REQUIRED_MESSAGE = "Введите текст";
export const DUE_DATE_REQUIRED_MESSAGE = "Укажите срок задачи";

/**
 * Родитель активности: ровно одна запись одного из четырёх типов (Plan.md 1.7).
 * Передаётся в action привязанным аргументом, но всё равно проверяется: клиент может подменить его.
 */
export const activityParentSchema = z.object({
  type: z.enum(["lead", "account", "contact", "opportunity"]),
  id: z.string().min(1),
});
export type ActivityParent = z.infer<typeof activityParentSchema>;

/**
 * Заметка — только текст; задача — текст и срок (дата без времени). Срок у заметки отбрасывается:
 * по CHECK-ограничению у заметки его быть не может.
 */
export const activityCreateSchema = z
  .object({
    type: z.enum(["note", "task"], { error: "Выберите: заметка или задача" }),
    body: requiredText(BODY_REQUIRED_MESSAGE, ACTIVITY_BODY_MAX),
    dueDate: optionalDate,
  })
  .superRefine((value, ctx) => {
    if (value.type === "task" && !value.dueDate) {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: DUE_DATE_REQUIRED_MESSAGE });
    }
  })
  .transform((value) => (value.type === "note" ? { ...value, dueDate: undefined } : value));
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;

/** Отметка выполнения задачи: `done` приходит строкой из формы или булевым значением. */
export const taskDoneSchema = z.object({
  id: z.preprocess(blankToUndefined, z.string({ error: "Задача не указана" })),
  done: z.preprocess((value) => (value === "true" ? true : value === "false" ? false : value), z.boolean()),
});
export type TaskDoneInput = z.infer<typeof taskDoneSchema>;
