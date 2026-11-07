"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";

const controlBase =
  "w-full rounded-sm bg-card px-3 text-body text-ink placeholder:text-ink-secondary " +
  "transition-colors disabled:cursor-not-allowed disabled:text-ink-disabled";

function controlClasses(error?: string) {
  // Ошибка выделяется толщиной границы и текстом, а не цветом (DESIGN.md, «Поля форм»).
  return `${controlBase} ${error ? "border-2 border-ink" : "border border-line-control"}`;
}

type FieldShellProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

function FieldShell({ id, label, required, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-baseline gap-2 text-small font-medium">
        {label}
        {required && <span className="text-caption font-normal text-ink-secondary">обязательно</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-small font-medium">
          <CircleAlert aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-small text-ink-secondary">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type CommonProps = {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  hint?: string;
  error?: string;
};

function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({
  name,
  label,
  defaultValue,
  required,
  hint,
  error,
  type = "text",
  autoComplete,
  inputMode,
  maxLength = 200,
}: CommonProps & {
  type?: "text" | "email" | "tel" | "url" | "date";
  autoComplete?: string;
  inputMode?: "decimal";
  maxLength?: number;
}) {
  const id = `field-${name}`;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        maxLength={type === "date" ? undefined : maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`h-10 ${controlClasses(error)}`}
      />
    </FieldShell>
  );
}

export function TextAreaField({ name, label, defaultValue, required, hint, error }: CommonProps) {
  const id = `field-${name}`;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <textarea
        id={id}
        name={name}
        rows={4}
        defaultValue={defaultValue ?? ""}
        required={required}
        maxLength={2000}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`py-2 ${controlClasses(error)}`}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  defaultValue,
  required,
  hint,
  error,
  options,
}: CommonProps & { options: { value: string; label: string }[] }) {
  const id = `field-${name}`;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <select
        // После action React 19 сбрасывает форму, а `<select>` применяет defaultValue только при монтировании:
        // без key сброс вернул бы первый вариант вместо значения, введённого до ошибки сервера.
        key={defaultValue ?? ""}
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`h-10 ${controlClasses(error)}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** Ошибка уровня формы: серый блок в начале формы, фокус переводится на него. */
export function FormError({ message }: { message?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  if (!message) return null;
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="flex items-start gap-3 rounded-lg bg-block p-4 text-body font-medium"
    >
      <TriangleAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      {message}
    </div>
  );
}
