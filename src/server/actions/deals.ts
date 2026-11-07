"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorToFormState } from "@/server/errors";
import { formValues, type FormState } from "@/server/form-state";
import { createDeal, deleteDeal, updateDeal } from "@/server/services/deals";
import { parseForm } from "@/server/validation/common";
import { dealCreateSchema, dealUpdateSchema } from "@/server/validation/deal";

// Сделка видна в своём разделе, в блоке «Сделки» карточек компании и контакта,
// названием в карточке конвертированного лида и в результатах глобального поиска.
function revalidateDealPages() {
  revalidatePath("/deals", "layout");
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
