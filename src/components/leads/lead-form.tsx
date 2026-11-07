"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormError, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { EDITABLE_LEAD_STATUSES, LEAD_SOURCE_LABELS, LEAD_SOURCES, LEAD_STATUS_LABELS } from "@/lib/leads";
import { EMPTY_FORM_STATE, type FormState } from "@/server/form-state";

/** Значения формы — только строки: Decimal и даты преобразуются на сервере до передачи в клиент. */
export type LeadFormValues = {
  contactName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status?: string | null;
  budget?: string | null;
  venue?: string | null;
  eventDate?: string | null;
  workFormat?: string | null;
  comment?: string | null;
};

const SOURCE_OPTIONS = [
  { value: "", label: "Выберите источник" },
  ...LEAD_SOURCES.map((source) => ({ value: source, label: LEAD_SOURCE_LABELS[source] })),
];

// «Конвертирован» в списке нет: этот статус ставит только конвертация (Plan.md 1.3).
const STATUS_OPTIONS = EDITABLE_LEAD_STATUSES.map((status) => ({ value: status, label: LEAD_STATUS_LABELS[status] }));

export function LeadForm({
  action,
  initial = {},
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: LeadFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const value = (key: keyof LeadFormValues) => state.values?.[key] ?? initial[key];
  const error = (key: keyof LeadFormValues) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormError message={state.message} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="contactName" label="Имя контакта" required defaultValue={value("contactName")} error={error("contactName")} autoComplete="name" />
        <TextField name="companyName" label="Компания" defaultValue={value("companyName")} error={error("companyName")} autoComplete="organization" />
        <TextField
          name="email"
          label="Email"
          type="email"
          defaultValue={value("email")}
          error={error("email")}
          hint="Нужен email или телефон"
          autoComplete="email"
        />
        <TextField
          name="phone"
          label="Телефон"
          type="tel"
          defaultValue={value("phone")}
          error={error("phone")}
          hint="Нужен email или телефон"
          autoComplete="tel"
        />
        <SelectField name="source" label="Источник" required defaultValue={value("source")} error={error("source")} options={SOURCE_OPTIONS} />
        <SelectField
          name="status"
          label="Статус"
          defaultValue={value("status") ?? "new"}
          error={error("status")}
          hint="«Конвертирован» ставится при конвертации"
          options={STATUS_OPTIONS}
        />
        <TextField
          name="budget"
          label="Бюджет, ₽"
          inputMode="decimal"
          defaultValue={value("budget")}
          error={error("budget")}
          hint="Например, 1 500 000"
          maxLength={20}
        />
        <TextField name="eventDate" label="Дата мероприятия" type="date" defaultValue={value("eventDate")} error={error("eventDate")} />
        <TextField name="venue" label="Площадка" defaultValue={value("venue")} error={error("venue")} />
        <TextField name="workFormat" label="Формат работ" defaultValue={value("workFormat")} error={error("workFormat")} />
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
