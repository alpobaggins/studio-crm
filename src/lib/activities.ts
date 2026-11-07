// Состояние задачи по сроку (Plan.md 1.7). Чистые функции без Next.js и Prisma: их используют сервер и тесты.
// Даты без времени (`@db.Date`) — Date на полночь UTC; «сегодня» вычисляется на сервере через
// `todayInTimeZone(getAppTimeZone())`, время браузера в расчёте не участвует.

import { pluralRu } from "./format";

export type DueState = "overdue" | "today" | "planned";
export type TaskState = DueState | "done";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Разница в днях между датами без времени: dueDate − today. */
function daysUntil(dueDate: Date, today: Date): number {
  return Math.round((dueDate.getTime() - today.getTime()) / DAY_MS);
}

/**
 * Выполненная задача никогда не просрочена. Невыполненная просрочена, если срок раньше сегодняшней даты;
 * задача на сегодня просроченной не считается.
 */
export function taskState(task: { dueDate: Date; done: boolean }, today: Date): TaskState {
  return task.done ? "done" : dueState(task.dueDate, today);
}

/** Срочность по сроку без учёта отметки: раньше сегодняшней даты — просрочено, сегодня — на сегодня. */
export function dueState(dueDate: Date, today: Date): DueState {
  const days = daysUntil(dueDate, today);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return "planned";
}

/** Подпись срока (DESIGN.md 7): «Сегодня», «Завтра», «Просрочено на 3 дня»; для остального — пусто. */
export function relativeDueLabel(task: { dueDate: Date; done: boolean }, today: Date): string | null {
  if (task.done) return null;
  const days = daysUntil(task.dueDate, today);
  if (days < 0) return `Просрочено на ${pluralRu(-days, ["день", "дня", "дней"])}`;
  if (days === 0) return "Сегодня";
  if (days === 1) return "Завтра";
  return null;
}
