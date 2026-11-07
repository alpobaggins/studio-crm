"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormError, TextAreaField, TextField } from "@/components/ui/field";
import { EMPTY_FORM_STATE, type FormState } from "@/server/form-state";

type AccountValues = {
  name?: string | null;
  industry?: string | null;
  city?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  comment?: string | null;
};

export function AccountForm({
  action,
  initial = {},
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: AccountValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  // После ошибки поля показывают то, что ввёл пользователь, а не исходные значения.
  const value = (key: keyof AccountValues) => state.values?.[key] ?? initial[key];
  const error = (key: keyof AccountValues) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormError message={state.message} />
      <TextField name="name" label="Название" required defaultValue={value("name")} error={error("name")} autoComplete="organization" />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="industry" label="Отрасль" defaultValue={value("industry")} error={error("industry")} />
        <TextField name="city" label="Город" defaultValue={value("city")} error={error("city")} autoComplete="address-level2" />
        <TextField name="email" label="Email" type="email" defaultValue={value("email")} error={error("email")} autoComplete="email" />
        <TextField name="phone" label="Телефон" type="tel" defaultValue={value("phone")} error={error("phone")} autoComplete="tel" />
      </div>
      <TextField name="website" label="Сайт" defaultValue={value("website")} error={error("website")} hint="Например, company.ru" autoComplete="url" />
      <TextAreaField name="comment" label="Комментарий" defaultValue={value("comment")} error={error("comment")} />
      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonClasses("secondary")}>
          Отмена
        </Link>
      </div>
    </form>
  );
}
