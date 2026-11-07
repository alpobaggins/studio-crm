"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormError, SelectField, TextField } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { pluralForm, pluralRu } from "@/lib/format";
import { EMPTY_FORM_STATE, type FormState } from "@/server/form-state";

/** Предзаполнение из лида — только строки: Decimal преобразован на сервере. */
export type LeadConvertFormValues = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  accountId?: string | null;
  dealName?: string | null;
  stageId?: string | null;
  amount?: string | null;
};

type Option = { id: string; name: string };

const MODES = [
  { value: "new", label: "Новая компания" },
  { value: "existing", label: "Существующая" },
] as const;

/**
 * Один экран конвертации (Plan.md 1.6, DESIGN.md «Диалог конвертации»): контакт, компания, сделка.
 * Скрытые части формы отключаются: их поля не отправляются и не мешают браузерной проверке,
 * а введённые значения сохраняются при переключении режима.
 */
export function LeadConvertForm({
  action,
  initial,
  accounts,
  openStages,
  activities,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: LeadConvertFormValues;
  accounts: Option[];
  openStages: Option[];
  activities: number;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  // После action React 19 сбрасывает форму к значениям по умолчанию. Поэтому переключатель и чекбокс
  // неуправляемые, а по умолчанию у них — отправленные значения, как у текстовых полей. Состояние ниже
  // только показывает нужные секции и после сброса совпадает с тем, что отмечено.
  const submittedMode = state.values?.companyMode === "existing" ? "existing" : "new";
  const submittedDeal = state.values?.createDeal === "on";
  const [mode, setMode] = useState<"new" | "existing">(submittedMode);
  const [createDeal, setCreateDeal] = useState(submittedDeal);
  const value = (key: keyof LeadConvertFormValues) => state.values?.[key] ?? initial[key];
  const error = (key: string) => state.fieldErrors?.[key];

  const activitiesNote =
    activities === 0
      ? null
      : `${pluralRu(activities, ["активность", "активности", "активностей"])} лида ` +
        `${pluralForm(activities, ["перейдёт", "перейдут", "перейдут"])} ` +
        `${createDeal ? "к новой сделке" : "к новому контакту"}: текст, сроки и отметки выполнения сохранятся.`;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FormError message={state.message} />

      <Section title="Контакт">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField name="fullName" label="Имя контакта" required defaultValue={value("fullName")} error={error("fullName")} autoComplete="off" />
          </div>
          <TextField name="email" label="Email" type="email" defaultValue={value("email")} error={error("email")} hint="Нужен email или телефон" autoComplete="off" />
          <TextField name="phone" label="Телефон" type="tel" defaultValue={value("phone")} error={error("phone")} hint="Нужен email или телефон" autoComplete="off" />
        </div>
      </Section>

      <Section title="Компания">
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 flex items-baseline gap-2 text-small font-medium">
              Компания контакта и сделки
              <span className="text-caption font-normal text-ink-secondary">обязательно</span>
            </legend>
            <div className="inline-flex self-start rounded-full bg-control p-1">
              {MODES.map((option) => (
                <label
                  key={option.value}
                  className={
                    "inline-flex h-8 cursor-pointer items-center rounded-full px-4 text-body font-semibold transition-colors " +
                    "has-checked:bg-inverse has-checked:text-ink-inverse " +
                    "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
                  }
                >
                  <input
                    type="radio"
                    name="companyMode"
                    value={option.value}
                    defaultChecked={submittedMode === option.value}
                    onChange={() => setMode(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {error("companyMode") && <p className="text-small font-medium">{error("companyMode")}</p>}
          </fieldset>

          <fieldset hidden={mode !== "new"} disabled={mode !== "new"}>
            <TextField
              name="companyName"
              label="Название новой компании"
              required
              defaultValue={value("companyName")}
              error={error("companyName")}
              hint="Компания создаётся вместе с контактом"
              autoComplete="off"
            />
          </fieldset>
          <fieldset hidden={mode !== "existing"} disabled={mode !== "existing"}>
            <SelectField
              name="accountId"
              label="Компания из базы"
              required
              defaultValue={value("accountId")}
              error={error("accountId")}
              hint="Контакт и сделка будут связаны с ней, новая компания не создаётся"
              options={[{ value: "", label: "Выберите компанию" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
            />
          </fieldset>
        </div>
      </Section>

      <Section title="Сделка">
        <div className="flex flex-col gap-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="createDeal"
              defaultChecked={submittedDeal}
              onChange={(event) => setCreateDeal(event.target.checked)}
              className="mt-0.5 size-5 shrink-0 cursor-pointer accent-ink"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-body font-medium">Создать сделку</span>
              <span className="text-small text-ink-secondary">Сделка будет связана с компанией и новым контактом</span>
            </span>
          </label>

          <fieldset hidden={!createDeal} disabled={!createDeal} className="flex flex-col gap-5">
            <TextField name="dealName" label="Название сделки" required defaultValue={value("dealName")} error={error("dealName")} autoComplete="off" />
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                name="stageId"
                label="Стадия"
                required
                defaultValue={value("stageId")}
                error={error("stageId")}
                hint="Только открытые стадии"
                options={openStages.map((s) => ({ value: s.id, label: s.name }))}
              />
              <TextField
                name="amount"
                label="Сумма, ₽"
                inputMode="decimal"
                defaultValue={value("amount")}
                error={error("amount")}
                hint="Из бюджета лида; можно изменить"
                maxLength={20}
              />
            </div>
            <p className="text-small text-ink-secondary">Площадка, дата мероприятия и формат работ перейдут в сделку из лида.</p>
          </fieldset>
        </div>
      </Section>

      <div className="flex flex-col gap-4 border-t border-line pt-5">
        {activitiesNote && <p className="text-body text-ink-secondary">{activitiesNote}</p>}
        <p className="text-body text-ink-secondary">
          После конвертации лид получит статус «Конвертирован» и станет доступен только для просмотра.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="accent" disabled={pending}>
            <ArrowRightLeft aria-hidden="true" size={18} />
            {pending ? "Конвертация…" : "Конвертировать"}
          </Button>
          <Link href={cancelHref} className={buttonClasses("secondary")}>
            Отмена
          </Link>
        </div>
      </div>
    </form>
  );
}
