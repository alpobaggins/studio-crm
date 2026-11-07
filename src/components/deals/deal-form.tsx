"use client";

import type { StageType } from "@prisma/client";
import Link from "next/link";
import { useActionState } from "react";
import { DealStatusBadge } from "@/components/deals/deal-status-badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormError, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { EMPTY_FORM_STATE, type FormState } from "@/server/form-state";

/** Значения формы — только строки: Decimal и даты преобразуются на сервере до передачи в клиент. */
export type DealFormValues = {
  name?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  stageId?: string | null;
  amount?: string | null;
  lostReason?: string | null;
  venue?: string | null;
  eventDate?: string | null;
  workFormat?: string | null;
  expectedCloseDate?: string | null;
  comment?: string | null;
};

type Option = { id: string; name: string };
export type ContactOption = { id: string; fullName: string; accountName: string | null };

/**
 * Стадия: при создании — выбор из открытых стадий, при изменении — только показ.
 * Стадию существующей сделки меняет отдельное действие «Сменить стадию» (Plan.md 1.5).
 */
type StageProps = { openStages: Option[]; current?: never } | { openStages?: never; current: { name: string; type: StageType } };

export function DealForm({
  action,
  accounts,
  contacts,
  stage,
  initial = {},
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  accounts: Option[];
  contacts: ContactOption[];
  stage: StageProps;
  initial?: DealFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const value = (key: keyof DealFormValues) => state.values?.[key] ?? initial[key];
  const error = (key: keyof DealFormValues) => state.fieldErrors?.[key];
  // Требования закрытой стадии показываются в форме заранее; проверяет их всё равно сервер.
  const type = stage.current?.type ?? "open";

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <FormError message={state.message} />
      <TextField name="name" label="Название сделки" required defaultValue={value("name")} error={error("name")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="accountId"
          label="Компания"
          required
          defaultValue={value("accountId")}
          error={error("accountId")}
          options={[{ value: "", label: "Выберите компанию" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
        />
        <SelectField
          name="contactId"
          label="Контакт"
          required={type === "won"}
          defaultValue={value("contactId")}
          error={error("contactId")}
          hint={type === "won" ? "Обязателен у выигранной сделки" : "Может быть из другой компании или без компании"}
          options={[
            // У выигранной сделки контакт нельзя очистить, поэтому пустого варианта нет.
            ...(type === "won" ? [{ value: "", label: "Выберите контакт" }] : [{ value: "", label: "Без контакта" }]),
            ...contacts.map((c) => ({ value: c.id, label: `${c.fullName} · ${c.accountName ?? "без компании"}` })),
          ]}
        />
        {stage.openStages ? (
          <SelectField
            name="stageId"
            label="Стадия"
            required
            defaultValue={value("stageId")}
            error={error("stageId")}
            hint="Новая сделка создаётся в открытой стадии"
            options={stage.openStages.map((s) => ({ value: s.id, label: s.name }))}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium">Стадия</span>
            <p className="flex h-10 items-center gap-2 text-body">
              {stage.current.name}
              {stage.current.type !== "open" && <DealStatusBadge type={stage.current.type} />}
            </p>
            <p className="text-small text-ink-secondary">Меняется действием «Сменить стадию», не в этой форме</p>
          </div>
        )}
        <TextField
          name="amount"
          label="Сумма, ₽"
          required={type === "won"}
          inputMode="decimal"
          defaultValue={value("amount")}
          error={error("amount")}
          hint={type === "won" ? "Больше нуля у выигранной сделки" : "Можно указать позже, например 1 500 000"}
          maxLength={20}
        />
      </div>
      {type === "lost" && (
        <TextField
          name="lostReason"
          label="Причина проигрыша"
          required
          defaultValue={value("lostReason")}
          error={error("lostReason")}
          maxLength={500}
        />
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="expectedCloseDate" label="Ожидаемая дата закрытия" type="date" defaultValue={value("expectedCloseDate")} error={error("expectedCloseDate")} />
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
