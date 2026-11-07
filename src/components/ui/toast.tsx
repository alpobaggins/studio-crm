"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export type ToastMessage = {
  /** Меняется при каждом показе — чтобы одинаковый текст объявлялся заново. */
  id: number;
  kind: "success" | "error";
  text: string;
  action?: { href: string; label: string };
};

/**
 * Тост (DESIGN.md, «Тост»): тёмная пилюля снизу по центру с действием-ссылкой.
 * Успех — `role="status"` и скрывается через 4 секунды; ошибка — `role="alert"` и остаётся до закрытия.
 */
export function Toast({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (toast?.kind !== "success") return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  return (
    // Контейнер живой области есть всегда: скринридер объявляет изменения только в уже существующем узле.
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div role={toast?.kind === "error" ? "alert" : "status"} aria-live={toast?.kind === "error" ? "assertive" : "polite"}>
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-[640px] items-center gap-3 rounded-full bg-inverse py-2 pl-5 pr-2 text-body text-ink-inverse shadow-overlay"
          >
            <span className="min-w-0 py-1">{toast.text}</span>
            {toast.action && (
              <Link
                href={toast.action.href}
                className="shrink-0 rounded-full px-2 py-1 font-semibold underline-offset-2 hover:underline"
              >
                {toast.action.label}
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть уведомление"
              className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-inverse-hover"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
