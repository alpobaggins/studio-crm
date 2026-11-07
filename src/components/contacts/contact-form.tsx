"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormError, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { EMPTY_FORM_STATE, type FormState } from "@/server/form-state";

type ContactValues = {
  fullName?: string | null;
  accountId?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  comment?: string | null;
};

export function ContactForm({
  action,
  accounts,
  initial = {},
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  accounts: { id: string; name: string }[];
  initial?: ContactValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const value = (key: keyof ContactValues) => state.values?.[key] ?? initial[key];
  const error = (key: keyof ContactValues) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormError message={state.message} />
      <TextField name="fullName" label="Имя и фамилия" required defaultValue={value("fullName")} error={error("fullName")} autoComplete="name" />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="accountId"
          label="Компания"
          defaultValue={value("accountId")}
          error={error("accountId")}
          hint="Можно не указывать"
          options={[{ value: "", label: "Без компании" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
        />
        <TextField name="position" label="Должность" defaultValue={value("position")} error={error("position")} autoComplete="organization-title" />
        <TextField name="email" label="Email" type="email" defaultValue={value("email")} error={error("email")} autoComplete="email" />
        <TextField name="phone" label="Телефон" type="tel" defaultValue={value("phone")} error={error("phone")} autoComplete="tel" />
      </div>
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
