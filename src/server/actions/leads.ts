"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorToFormState } from "@/server/errors";
import { formValues, type FormState } from "@/server/form-state";
import { convertLead } from "@/server/services/lead-conversion";
import { createLead, deleteLead, updateLead } from "@/server/services/leads";
import { parseForm } from "@/server/validation/common";
import { leadSchema } from "@/server/validation/lead";
import { leadConversionSchema } from "@/server/validation/lead-conversion";

// Список с любыми фильтрами, карточка и форма изменения лежат под /leads; имя лида показано
// в карточке созданной из него сделки; лиды есть в результатах глобального поиска.
function revalidateLeadPages() {
  revalidatePath("/leads", "layout");
  revalidatePath("/deals", "layout");
  revalidatePath("/search");
}

export async function createLeadAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = parseForm(leadSchema, formData);
  if (!parsed.ok) return { message: "Проверьте выделенные поля.", fieldErrors: parsed.fieldErrors, values };

  let id: string;
  try {
    ({ id } = await createLead(parsed.data));
  } catch (error) {
    return errorToFormState(error, values);
  }
  revalidateLeadPages();
  redirect(`/leads/${id}`);
}

export async function updateLeadAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = parseForm(leadSchema, formData);
  if (!parsed.ok) return { message: "Проверьте выделенные поля.", fieldErrors: parsed.fieldErrors, values };

  try {
    await updateLead(id, parsed.data);
  } catch (error) {
    return errorToFormState(error, values);
  }
  revalidateLeadPages();
  redirect(`/leads/${id}`);
}

export async function deleteLeadAction(id: string): Promise<FormState> {
  try {
    await deleteLead(id);
  } catch (error) {
    return errorToFormState(error);
  }
  revalidateLeadPages();
  redirect("/leads");
}

// Конвертация создаёт компанию (или связывает с существующей), контакт и, по выбору, сделку:
// они появляются в своих разделах, в карточках друг друга и в глобальном поиске.
function revalidateConversionPages() {
  revalidatePath("/leads", "layout");
  revalidatePath("/accounts", "layout");
  revalidatePath("/contacts", "layout");
  revalidatePath("/deals", "layout");
  revalidatePath("/pipeline");
  revalidatePath("/search");
}

export async function convertLeadAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = parseForm(leadConversionSchema, formData);
  if (!parsed.ok) return { message: "Проверьте выделенные поля.", fieldErrors: parsed.fieldErrors, values };

  try {
    await convertLead(id, parsed.data);
  } catch (error) {
    return errorToFormState(error, values);
  }
  revalidateConversionPages();
  redirect(`/leads/${id}`);
}
