"use server";

import { revalidatePath } from "next/cache";
import { errorToFormState } from "@/server/errors";
import { formValues, type FormState } from "@/server/form-state";
import { createActivity, setTaskDone } from "@/server/services/activities";
import { activityCreateSchema, activityParentSchema, taskDoneSchema, type ActivityParent } from "@/server/validation/activity";
import { parseForm } from "@/server/validation/common";

const PARENT_PATH: Record<ActivityParent["type"], string> = {
  lead: "/leads",
  account: "/accounts",
  contact: "/contacts",
  opportunity: "/deals",
};

/**
 * Активности видны только в карточке своего родителя (там же — число активностей в диалоге удаления),
 * а у сделки ещё и бейджем «Просрочено» на доске воронки.
 */
function revalidateActivityPages(parent: ActivityParent) {
  revalidatePath(`${PARENT_PATH[parent.type]}/${parent.id}`);
  if (parent.type === "opportunity") revalidatePath("/pipeline");
}

const BAD_PARENT_MESSAGE = "Не удалось определить, к какой записи относится активность. Обновите страницу.";

/** Результат действий ленты: без redirect — пользователь остаётся в карточке. */
export type ActivityState = FormState & { ok?: true; type?: "note" | "task"; savedAt?: number };

/** Быстрые действия «Добавить заметку» и «Добавить задачу» — один action для всех карточек (Plan.md 1.9). */
export async function createActivityAction(
  parent: ActivityParent,
  _prev: ActivityState,
  formData: FormData,
): Promise<ActivityState> {
  const values = formValues(formData);
  const parentResult = activityParentSchema.safeParse(parent);
  if (!parentResult.success) return { message: BAD_PARENT_MESSAGE, values };
  const parsed = parseForm(activityCreateSchema, formData);
  if (!parsed.ok) return { message: "Проверьте выделенные поля.", fieldErrors: parsed.fieldErrors, values };

  try {
    await createActivity(parentResult.data, parsed.data);
  } catch (error) {
    return errorToFormState(error, values);
  }
  revalidateActivityPages(parentResult.data);
  return { ok: true, type: parsed.data.type, savedAt: Date.now() };
}

/** Отметка «Выполнена» и возврат задачи в работу. */
export async function setTaskDoneAction(formData: FormData): Promise<ActivityState> {
  const parsed = parseForm(taskDoneSchema, formData);
  if (!parsed.ok) return { message: "Не удалось изменить задачу. Обновите страницу и попробуйте ещё раз." };

  let parent: ActivityParent;
  try {
    ({ parent } = await setTaskDone(parsed.data));
  } catch (error) {
    return errorToFormState(error);
  }
  revalidateActivityPages(parent);
  return { ok: true };
}
