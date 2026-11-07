import type { Prisma } from "@prisma/client";
import { dueState, relativeDueLabel, type DueState } from "@/lib/activities";
import { formatDate, formatDateInZone } from "@/lib/format";
import { prisma } from "@/server/db";
import type { ActivityParent } from "@/server/validation/activity";

/**
 * Условие «просроченная задача» для запросов (Plan.md 1.7): задача, не выполнена, срок раньше сегодняшней даты.
 * today — `todayInTimeZone(getAppTimeZone())`. То же правило, что у `taskState`, но на стороне базы.
 */
export function overdueTaskWhere(today: Date): Prisma.ActivityWhereInput {
  return { type: "task", done: false, dueDate: { lt: today } };
}

const PARENT_WHERE = {
  lead: (id: string) => ({ leadId: id }),
  account: (id: string) => ({ accountId: id }),
  contact: (id: string) => ({ contactId: id }),
  opportunity: (id: string) => ({ opportunityId: id }),
} satisfies Record<ActivityParent["type"], (id: string) => Prisma.ActivityWhereInput>;

/** Активность для ленты: всё уже посчитано и отформатировано на сервере, клиенту передаются только строки. */
export type FeedActivity = {
  id: string;
  type: "note" | "task";
  body: string;
  done: boolean;
  /**
   * Только у задачи: срочность по сроку без учёта отметки. Итоговое состояние — `done ? "done" : dueState` (как `taskState`);
   * так отметку можно показать сразу и снять без нового расчёта даты в браузере.
   */
  dueState: DueState | null;
  dueLabel: string | null;
  /** «Просрочено на 3 дня», «Сегодня», «Завтра» — по сроку, без учёта отметки. */
  relativeLabel: string | null;
  createdLabel: string;
};

/**
 * Лента активностей карточки (DESIGN.md, «Лента активностей»): сначала невыполненные задачи по сроку,
 * затем остальное (заметки и выполненные задачи) по дате создания, новые сверху.
 */
export async function listActivities(parent: ActivityParent, today: Date, timeZone: string): Promise<FeedActivity[]> {
  const activities = await prisma.activity.findMany({
    where: PARENT_WHERE[parent.type](parent.id),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { id: true, type: true, body: true, dueDate: true, done: true, createdAt: true },
  });
  const openTasks = activities
    .filter((a) => a.type === "task" && !a.done)
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));
  const rest = activities.filter((a) => !(a.type === "task" && !a.done));

  return [...openTasks, ...rest].map((a) => {
    const task = a.type === "task" && a.dueDate ? { dueDate: a.dueDate, done: false } : null;
    return {
      id: a.id,
      type: a.type,
      body: a.body,
      done: a.done,
      dueState: task && dueState(task.dueDate, today),
      dueLabel: task && formatDate(task.dueDate),
      relativeLabel: task && relativeDueLabel(task, today),
      createdLabel: formatDateInZone(a.createdAt, timeZone),
    };
  });
}
