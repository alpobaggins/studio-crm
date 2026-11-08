"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorToFormState } from "@/server/errors";
import { formValues, type FormState } from "@/server/form-state";
import { createContact, deleteContact, updateContact } from "@/server/services/contacts";
import { parseForm } from "@/server/validation/common";
import { contactSchema } from "@/server/validation/contact";

// Контакты показываются в карточке компании, в количестве контактов в списке компаний,
// в списке и карточке сделок, в списке контактов формы сделки и в карточке конвертированного лида;
// удаление контакта удаляет его задачи — меняется KPI дашборда.
function revalidateContactPages() {
  revalidatePath("/contacts", "layout");
  revalidatePath("/leads", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/accounts", "layout");
  revalidatePath("/deals", "layout");
  revalidatePath("/pipeline");
  revalidatePath("/search");
}

export async function createContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = parseForm(contactSchema, formData);
  if (!parsed.ok) return { message: "Проверьте выделенные поля.", fieldErrors: parsed.fieldErrors, values };

  let id: string;
  try {
    ({ id } = await createContact(parsed.data));
  } catch (error) {
    return errorToFormState(error, values);
  }
  revalidateContactPages();
  redirect(`/contacts/${id}`);
}

export async function updateContactAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = parseForm(contactSchema, formData);
  if (!parsed.ok) return { message: "Проверьте выделенные поля.", fieldErrors: parsed.fieldErrors, values };

  try {
    await updateContact(id, parsed.data);
  } catch (error) {
    return errorToFormState(error, values);
  }
  revalidateContactPages();
  redirect(`/contacts/${id}`);
}

export async function deleteContactAction(id: string): Promise<FormState> {
  try {
    await deleteContact(id);
  } catch (error) {
    return errorToFormState(error);
  }
  revalidateContactPages();
  redirect("/contacts");
}
