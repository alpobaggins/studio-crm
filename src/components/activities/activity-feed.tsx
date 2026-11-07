"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  startTransition,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { ListTodo, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, TextAreaField, TextField } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { Toast, type ToastMessage } from "@/components/ui/toast";
import { createActivityAction, setTaskDoneAction, type ActivityState } from "@/server/actions/activities";
import type { FeedActivity } from "@/server/queries/activities";
import type { ActivityParent } from "@/server/validation/activity";
import { TaskStateBadge } from "./task-state-badge";

type ActivityType = "note" | "task";

const SAVED_TEXT: Record<ActivityType, string> = { note: "Заметка добавлена", task: "Задача добавлена" };

/**
 * Лента активностей карточки (DESIGN.md, «Лента активностей») и быстрые действия «Добавить заметку»
 * и «Добавить задачу» (Plan.md 1.9). Состояние задачи («Просрочено», «Сегодня») посчитано на сервере
 * по APP_TIME_ZONE и приходит готовым: время браузера здесь не используется.
 * locked — вместо быстрых действий, когда добавлять нельзя (конвертированный лид).
 */
export function ActivityFeed({
  parent,
  activities,
  locked,
}: {
  parent: ActivityParent;
  activities: FeedActivity[];
  locked?: ReactNode;
}) {
  const [formType, setFormType] = useState<ActivityType | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);

  // После закрытия формы фокус возвращается к быстрым действиям, а не теряется на body.
  // Эффект срабатывает после фиксации рендера, когда кнопки уже снова в DOM.
  useEffect(() => {
    if (formType === null && restoreFocus.current) {
      restoreFocus.current = false;
      quickActionsRef.current?.querySelector("button")?.focus();
    }
  }, [formType]);

  const open = (type: ActivityType) => {
    setFormKey((key) => key + 1);
    setFormType(type);
  };
  const close = () => {
    restoreFocus.current = true;
    setFormType(null);
  };

  return (
    <Section title={`Активности · ${activities.length}`}>
      <div className="flex flex-col gap-4">
        {locked ??
          (formType ? (
            <ActivityForm
              key={formKey}
              parent={parent}
              initialType={formType}
              onCancel={close}
              onSaved={(type, savedAt) => {
                close();
                setToast({ id: savedAt, kind: "success", text: SAVED_TEXT[type] });
              }}
            />
          ) : (
            <div ref={quickActionsRef} className="flex flex-wrap gap-2" role="group" aria-label="Быстрые действия">
              <Button variant="secondary" onClick={() => open("note")}>
                <StickyNote aria-hidden="true" size={16} />
                Добавить заметку
              </Button>
              <Button variant="secondary" onClick={() => open("task")}>
                <ListTodo aria-hidden="true" size={16} />
                Добавить задачу
              </Button>
            </div>
          ))}

        {activities.length === 0 ? (
          <p className="text-body text-ink-secondary">Заметок и задач пока нет.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {activities.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                onError={(text) => setToast({ id: Date.now(), kind: "error", text })}
              />
            ))}
          </ul>
        )}
      </div>
      <Toast toast={toast} onClose={closeToast} />
    </Section>
  );
}

/**
 * Компактная форма с переключателем «Заметка / Задача». Проверяет сервер: пустой текст и задача
 * без срока или с несуществующей датой отклоняются, введённое сохраняется.
 */
function ActivityForm({
  parent,
  initialType,
  onCancel,
  onSaved,
}: {
  parent: ActivityParent;
  initialType: ActivityType;
  onCancel: () => void;
  onSaved: (type: ActivityType, savedAt: number) => void;
}) {
  // Успех сообщается из самого action. Обновления после await оборачиваются в startTransition:
  // так форма закрывается в том же рендере, где лента уже получила новую запись от revalidatePath.
  const [state, formAction, pending] = useActionState<ActivityState, FormData>(async (prev, formData) => {
    const result = await createActivityAction(parent, prev, formData);
    const { type, savedAt } = result;
    if (result.ok && type && savedAt) startTransition(() => onSaved(type, savedAt));
    return result;
  }, {});
  const [type, setType] = useState<ActivityType>(initialType);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.querySelector("textarea")?.focus();
  }, []);

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={type === "note" ? "Новая заметка" : "Новая задача"}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      className="flex flex-col gap-4 rounded-lg bg-block p-4 sm:p-5"
    >
      <FormError message={state.message} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-small font-medium">Тип</legend>
        <div className="flex flex-wrap gap-2">
          {(["note", "task"] as const).map((value) => (
            <label
              key={value}
              className={`inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-body font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                type === value ? "bg-inverse text-ink-inverse" : "bg-card text-ink hover:bg-control"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="sr-only"
              />
              {value === "note" ? "Заметка" : "Задача"}
            </label>
          ))}
        </div>
      </fieldset>
      <TextAreaField
        name="body"
        label={type === "note" ? "Текст заметки" : "Что сделать"}
        required
        defaultValue={state.values?.body}
        error={state.fieldErrors?.body}
      />
      {type === "task" && (
        <div className="sm:max-w-60">
          <TextField
            name="dueDate"
            label="Срок"
            type="date"
            required
            defaultValue={state.values?.dueDate}
            error={state.fieldErrors?.dueDate}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : type === "note" ? "Добавить заметку" : "Добавить задачу"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

const noopSubscribe = () => () => {};

/** false в HTML с сервера и до гидратации, true — когда обработчики React подключены. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function ActivityItem({ activity, onError }: { activity: FeedActivity; onError: (text: string) => void }) {
  const [pending, startTransition] = useTransition();
  // До гидратации клик поставил бы галочку без сохранения — чекбокс неактивен, пока React не подключён.
  const hydrated = useHydrated();
  // Отметка видна сразу; если сервер отказал, после перехода вернётся значение из базы.
  const [done, setOptimisticDone] = useOptimistic(activity.done);
  const isTask = activity.type === "task";

  const toggle = (next: boolean) => {
    startTransition(async () => {
      setOptimisticDone(next);
      const data = new FormData();
      data.set("id", activity.id);
      data.set("done", String(next));
      const result = await setTaskDoneAction(data);
      if (!result.ok) onError(result.message ?? "Не удалось изменить задачу.");
    });
  };

  // Выполненная задача не просрочена: срочность показывается только у невыполненной (Plan.md 1.7).
  const state = activity.dueState && (done ? "done" : activity.dueState);
  const meta = isTask
    ? ["Задача", `срок ${activity.dueLabel}`, state === "overdue" || activity.relativeLabel === "Завтра" ? activity.relativeLabel : null]
    : ["Заметка", activity.createdLabel];

  return (
    <li className="flex items-start gap-3 py-3">
      {isTask ? (
        // Цель касания 44 px при видимом чекбоксе 20 px (DESIGN.md 3.3, «Лента активностей»).
        <label className="-m-3 flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={done}
            disabled={pending || !hydrated}
            onChange={(event) => toggle(event.target.checked)}
            aria-label={`Выполнена: ${activity.body}`}
            className="size-5 cursor-pointer accent-ink disabled:cursor-wait"
          />
        </label>
      ) : (
        <span className="flex size-5 shrink-0 items-center justify-center text-ink-secondary" aria-hidden="true">
          <StickyNote size={18} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-small text-ink-secondary">{meta.filter(Boolean).join(" · ")}</p>
          {state && <TaskStateBadge state={state} />}
        </div>
        <p className={`mt-1 whitespace-pre-line break-words text-body ${done ? "text-ink-secondary line-through" : ""}`}>
          {activity.body}
        </p>
      </div>
    </li>
  );
}
