"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorToFormState } from "@/server/errors";
import { formValues, type FormState } from "@/server/form-state";
import { changeDealStage, createDeal, deleteDeal, updateDeal } from "@/server/services/deals";
import { parseForm } from "@/server/validation/common";
import { dealCreateSchema, dealStageChangeSchema, dealUpdateSchema } from "@/server/validation/deal";

// Сделка видна в своём разделе, на доске воронки, в блоке «Сделки» карточек компании и контакта,
// названием в карточке конвертированного лида, в результатах глобального поиска и в показателях дашборда.
function revalidateDealPages() {
  revalidatePath("/deals", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  revalidatePath("/accounts", "layout");
  revalidatePath("/contacts", "layout");
  revalidatePath("/leads", "layout");
  revalidatePath("/search");
}

export async function createDealAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = parseForm(dealCreateSchema, formData);
  if (!parsed.ok) return { message: "Проверьте выделенные поля.", fieldErrors: parsed.fieldErrors, values };

  let id: string;
  try {
    ({ id } = await createDeal(parsed.data));
  } catch (error) {
    return errorToFormState(error, values);
  }
  revalidateDealPages();
  redirect(`/deals/${id}`);
}

export async function updateDealAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = parseForm(dealUpdateSchema, formData);
  if (!parsed.ok) return { message: "Проверьте выделенные поля.", fieldErrors: parsed.fieldErrors, values };

  try {
    await updateDeal(id, parsed.data);
  } catch (error) {
    return errorToFormState(error, values);
  }
  revalidateDealPages();
  redirect(`/deals/${id}`);
}

export async function deleteDealAction(id: string): Promise<FormState> {
  try {
    await deleteDeal(id);
  } catch (error) {
    return errorToFormState(error);
  }
  revalidateDealPages();
  redirect("/deals");
}

/** Результат смены стадии: без redirect — диалог и Kanban остаются на своей странице. */
export type StageChangeState = FormState & { ok?: true; stageName?: string };

/**
 * Смена стадии из карточки сделки и из Kanban — один action и один сервис (Plan.md 1.5).
 * Обновлённые данные приходят вместе с ответом action благодаря `revalidatePath`.
 */
export async function changeDealStageAction(id: string, formData: FormData): Promise<StageChangeState> {
  const values = formValues(formData);
  const parsed = parseForm(dealStageChangeSchema, formData);
  if (!parsed.ok) return { message: "Проверьте выделенные поля.", fieldErrors: parsed.fieldErrors, values };

  let stageName: string;
  try {
    ({ stageName } = await changeDealStage(id, parsed.data));
  } catch (error) {
    return errorToFormState(error, values);
  }
  revalidateDealPages();
  return { ok: true, stageName };
}
