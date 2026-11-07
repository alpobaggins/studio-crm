"use client";

import { useActionState, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { EMPTY_FORM_STATE, type FormState } from "@/server/form-state";

/**
 * Кнопка «Удалить» с подтверждением в диалоге (DESIGN.md, «Диалог»).
 * Если удаление заблокировано связями — диалог объясняет причину и не предлагает удалить.
 * Сервер всё равно перепроверяет правило: между открытием карточки и нажатием данные могли измениться.
 */
export function DeleteButton({
  title,
  consequences,
  blockedReason,
  action,
}: {
  title: string;
  consequences: string;
  blockedReason: string | null;
  action: () => Promise<FormState>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <Button variant="danger" onClick={() => dialogRef.current?.showModal()}>
        <Trash2 aria-hidden="true" size={18} />
        Удалить
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="delete-dialog-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto w-[480px] max-w-[calc(100vw-2rem)] rounded-lg bg-card p-0 text-ink shadow-overlay backdrop:bg-ink/40 max-sm:mb-0 max-sm:max-w-full max-sm:w-full max-sm:rounded-b-none"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id="delete-dialog-title" className="text-title-2">
            {title}
          </h2>
          {blockedReason ? (
            <>
              <p className="text-body">{blockedReason}</p>
              <div className="flex justify-end">
                <Button variant="secondary" onClick={close}>
                  Понятно
                </Button>
              </div>
            </>
          ) : (
            <form action={formAction} className="flex flex-col gap-4">
              <p className="text-body text-ink-secondary">{consequences}</p>
              <FormError message={state.message} />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={close} disabled={pending}>
                  Отмена
                </Button>
                <Button type="submit" variant="danger" disabled={pending}>
                  <Trash2 aria-hidden="true" size={18} />
                  {pending ? "Удаление…" : "Удалить"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
