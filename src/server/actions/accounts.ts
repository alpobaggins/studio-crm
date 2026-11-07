"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorToFormState } from "@/server/errors";
import { formValues, type FormState } from "@/server/form-state";
import { createAccount, deleteAccount, updateAccount } from "@/server/services/accounts";
import { accountSchema } from "@/server/validation/account";
import { parseForm } from "@/server/validation/common";

// Компании показываются и в разделах контактов и сделок (название компании у контакта и сделки).
function revalidateAccountPages() {
  revalidatePath("/accounts", "layout");
  revalidatePath("/contacts", "layout");
  revalidatePath("/deals", "layout");
  revalidatePath("/pipeline");
  revalidatePath("/search");
}

export async function createAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = parseForm(accountSchema, formData);
  if (!parsed.ok) return { message: "Проверьте выделенные поля.", fieldErrors: parsed.fieldErrors, values };

  let id: string;
  try {
    ({ id } = await createAccount(parsed.data));
  } catch (error) {
    return errorToFormState(error, values);
  }
  revalidateAccountPages();
  redirect(`/accounts/${id}`);
}

export async function updateAccountAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = parseForm(accountSchema, formData);
  if (!parsed.ok) return { message: "Проверьте выделенные поля.", fieldErrors: parsed.fieldErrors, values };

  try {
    await updateAccount(id, parsed.data);
  } catch (error) {
    return errorToFormState(error, values);
  }
  revalidateAccountPages();
  redirect(`/accounts/${id}`);
}

export async function deleteAccountAction(id: string): Promise<FormState> {
  try {
    await deleteAccount(id);
  } catch (error) {
    return errorToFormState(error);
  }
  revalidateAccountPages();
  redirect("/accounts");
}
