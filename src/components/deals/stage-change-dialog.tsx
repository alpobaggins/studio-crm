"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import type { StageType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { FormError, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { changeDealStageAction } from "@/server/actions/deals";

export type StageOption = { id: string; name: string; type: StageType };
export type StageContactOption = { id: string; fullName: string; accountName: string | null };
/** Что диалогу нужно знать о сделке. Сумма — строка Decimal. */
export type StageDeal = { id: string; name: string; stageId: string; amount: string | null; contactId: string | null };

/**
 * Запрос на показ диалога: целевая стадия (из меню — не выбрана, из Kanban — колонка, куда перенесли)
 * и, если сервер уже отказал, его сообщение и ошибки полей.
 */
export type StageRequest = { targetId: string | null; message?: string; fieldErrors?: Record<string, string> };

type Props = {
  deal: StageDeal;
  stages: StageOption[];
  contacts: StageContactOption[];
  request: StageRequest | null;
  onClose: () => void;
  onSuccess: (stageName: string) => void;
};

/**
 * Компактный диалог «Сменить стадию» (DESIGN.md, «Диалог», «Kanban»). Один и тот же для карточки сделки и Kanban.
 * Правил стадий здесь нет: диалог только предлагает поля, которые нужны целевой стадии, а проверяет сервер
 * (`changeDealStage`, Plan.md 1.5). Отказ сервера показывается в диалоге, введённые значения сохраняются.
 */
export function StageChangeDialog({ deal, stages, contacts, request, onClose, onSuccess }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Новый запрос — новая форма: выбор и ошибки прошлого показа не переносятся. Ключ меняется во время
  // рендера, до showModal: иначе форма пересоздалась бы после открытия и фокус ушёл бы из диалога.
  const [shownRequest, setShownRequest] = useState(request);
  const [requestKey, setRequestKey] = useState(0);
  if (request !== shownRequest) {
    setShownRequest(request);
    if (request) setRequestKey((key) => key + 1);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="stage-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[480px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg bg-card p-0 text-ink shadow-overlay backdrop:bg-ink/40 max-sm:mb-0 max-sm:w-full max-sm:max-w-full max-sm:rounded-b-none"
    >
      {request && (
        <StageChangeForm
          key={requestKey}
          deal={deal}
          stages={stages}
          contacts={contacts}
          request={request}
          onCancel={() => dialogRef.current?.close()}
          onSuccess={onSuccess}
        />
      )}
    </dialog>
  );
}

function StageChangeForm({
  deal,
  stages,
  contacts,
  request,
  onCancel,
  onSuccess,
}: Omit<Props, "request" | "onClose"> & { request: StageRequest; onCancel: () => void }) {
  const [targetId, setTargetId] = useState(request.targetId);
  const [result, setResult] = useState({ message: request.message, fieldErrors: request.fieldErrors });
  const [pending, startTransition] = useTransition();

  const current = stages.find((stage) => stage.id === deal.stageId);
  const target = stages.find((stage) => stage.id === targetId);
  const reopening = current && current.type !== "open" && target?.type === "open";
  const error = (name: string) => result.fieldErrors?.[name];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("fromStageId", deal.stageId);
    startTransition(async () => {
      const response = await changeDealStageAction(deal.id, formData);
      if (response.ok) onSuccess(response.stageName ?? "");
      else setResult({ message: response.message, fieldErrors: response.fieldErrors });
    });
  }

  const submitLabel =
    target?.type === "won"
      ? "Закрыть как выигранную"
      : target?.type === "lost"
        ? "Закрыть как проигранную"
        : reopening
          ? "Вернуть в работу"
          : "Сменить стадию";

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-6" noValidate>
      <div>
        <h2 id="stage-dialog-title" className="text-title-2">
          Сменить стадию
        </h2>
        <p className="mt-1 text-body text-ink-secondary">{deal.name}</p>
      </div>

      <FormError message={result.message} />

      <fieldset className="flex flex-col gap-1.5" aria-describedby={error("stageId") ? "stage-error" : undefined}>
        <legend className="mb-1.5 text-small font-medium">Новая стадия</legend>
        {stages.map((stage, index) => {
          const isCurrent = stage.id === deal.stageId;
          // Закрытые стадии отделены, как на доске: результат, а не следующий этап работы.
          const separated = stage.type !== "open" && stages[index - 1]?.type === "open";
          return (
            <label
              key={stage.id}
              className={`flex min-h-11 items-center gap-3 rounded-sm border px-3 text-body transition-colors ${
                separated ? "mt-2" : ""
              } ${
                isCurrent
                  ? "cursor-not-allowed border-line-control text-ink-secondary"
                  : "cursor-pointer border-line-control hover:bg-subtle has-[:checked]:border-2 has-[:checked]:border-ink has-[:checked]:font-semibold"
              }`}
            >
              <input
                type="radio"
                name="stageId"
                value={stage.id}
                checked={targetId === stage.id}
                disabled={isCurrent || pending}
                onChange={() => setTargetId(stage.id)}
                className="size-4 accent-[var(--text-primary)]"
              />
              <span className="min-w-0 flex-1">{stage.name}</span>
              {isCurrent && <span className="text-caption">текущая</span>}
            </label>
          );
        })}
        {error("stageId") && (
          <p id="stage-error" className="text-small font-medium">
            {error("stageId")}
          </p>
        )}
      </fieldset>

      {target?.type === "won" && (
        <div className="flex flex-col gap-4 rounded-lg bg-subtle p-4">
          <p className="text-small text-ink-secondary">
            Для выигрыша нужны сумма больше нуля и контакт. Проверьте их или заполните недостающее — данные сохранятся
            в сделке.
          </p>
          <TextField
            name="amount"
            label="Сумма, ₽"
            required
            inputMode="decimal"
            defaultValue={deal.amount}
            error={error("amount")}
          />
          <SelectField
            name="contactId"
            label="Контакт"
            required
            defaultValue={deal.contactId}
            error={error("contactId")}
            options={[
              { value: "", label: "Не выбран" },
              ...contacts.map((c) => ({ value: c.id, label: `${c.fullName} · ${c.accountName ?? "без компании"}` })),
            ]}
          />
        </div>
      )}

      {target?.type === "lost" && (
        <TextAreaField
          name="lostReason"
          label="Причина проигрыша"
          required
          hint="Например: выбрали другого подрядчика, мероприятие отменено."
          error={error("lostReason")}
        />
      )}

      {reopening && (
        <p className="rounded-lg bg-subtle p-4 text-body">
          Сделка вернётся в работу: дата закрытия
          {current?.type === "lost" ? " и причина проигрыша будут очищены." : " будет очищена."}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Отмена
        </Button>
        <Button type="submit" disabled={!target || pending} aria-busy={pending || undefined}>
          {pending ? "Сохранение…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
