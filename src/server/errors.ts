import { Prisma } from "@prisma/client";
import type { FormState } from "./form-state";

/** Ошибка бизнес-правила: сообщение показывается пользователю как есть. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** Переводит любую ошибку в русское сообщение для формы. Технические детали — только в лог сервера. */
export function errorToFormState(error: unknown, values?: Record<string, string>): FormState {
  if (error instanceof DomainError) {
    return { message: error.message, fieldErrors: error.fieldErrors, values };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const byCode: Record<string, string> = {
      P2025: "Запись не найдена — возможно, её уже удалили.",
      P2003: "Действие невозможно: запись связана с другими данными.",
    };
    const message = byCode[error.code];
    if (message) return { message, values };
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { message: "Нет подключения к базе данных. Проверьте, что PostgreSQL запущен.", values };
  }
  console.error(error);
  return { message: "Не удалось выполнить действие. Попробуйте ещё раз.", values };
}
