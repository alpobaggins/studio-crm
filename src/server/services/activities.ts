// Заметки и задачи (Plan.md 1.7). Без зависимостей от Next.js — вызываются из actions и тестов.
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import type { ActivityCreateInput, ActivityParent, TaskDoneInput } from "@/server/validation/activity";

export const PARENT_NOT_FOUND_MESSAGE = "Запись не найдена — возможно, её уже удалили.";
export const TASK_NOT_FOUND_MESSAGE = "Задача не найдена — возможно, её удалили вместе с записью.";
export const NOTE_DONE_MESSAGE = "Выполненной можно отметить только задачу, не заметку.";
export const LEAD_CONVERTED_MESSAGE =
  "Лид уже конвертирован, его заметки и задачи перенесены. Добавляйте их в карточке сделки или контакта.";

/** Внешний ключ активности для родителя: заполнено ровно одно поле (CHECK в миграции). */
function parentFields(parent: ActivityParent) {
  switch (parent.type) {
    case "lead":
      return { leadId: parent.id };
    case "account":
      return { accountId: parent.id };
    case "contact":
      return { contactId: parent.id };
    case "opportunity":
      return { opportunityId: parent.id };
  }
}

/** Родитель активности по её внешним ключам — чтобы action обновил нужную карточку. */
export function activityParentOf(activity: {
  leadId: string | null;
  accountId: string | null;
  contactId: string | null;
  opportunityId: string | null;
}): ActivityParent {
  if (activity.leadId) return { type: "lead", id: activity.leadId };
  if (activity.accountId) return { type: "account", id: activity.accountId };
  if (activity.contactId) return { type: "contact", id: activity.contactId };
  if (activity.opportunityId) return { type: "opportunity", id: activity.opportunityId };
  throw new Error("У активности нет родителя — нарушено CHECK-ограничение.");
}

/** Существует ли родитель. Для лида — блокировка строки до конца транзакции и проверка статуса. */
async function assertParentAcceptsActivity(tx: Prisma.TransactionClient, parent: ActivityParent): Promise<void> {
  if (parent.type === "lead") {
    // FOR UPDATE ждёт параллельную конвертацию: она тоже обновляет эту строку первой (Plan.md 1.6).
    // После её фиксации статус уже `converted`, и активность не останется у лида, а действие будет отклонено.
    const rows = await tx.$queryRaw<{ status: string }[]>`
      SELECT "status"::text AS "status" FROM "Lead" WHERE "id" = ${parent.id} FOR UPDATE`;
    if (rows.length === 0) throw new DomainError(PARENT_NOT_FOUND_MESSAGE);
    if (rows[0].status === "converted") throw new DomainError(LEAD_CONVERTED_MESSAGE);
    return;
  }
  const count =
    parent.type === "account"
      ? await tx.account.count({ where: { id: parent.id } })
      : parent.type === "contact"
        ? await tx.contact.count({ where: { id: parent.id } })
        : await tx.opportunity.count({ where: { id: parent.id } });
  if (count === 0) throw new DomainError(PARENT_NOT_FOUND_MESSAGE);
}

/**
 * Создаёт заметку или задачу у одного родителя. Заметка — без срока и не выполнена,
 * задача — со сроком (дата без времени) и не выполнена.
 */
export async function createActivity(parent: ActivityParent, input: ActivityCreateInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      await assertParentAcceptsActivity(tx, parent);
      return tx.activity.create({
        data: {
          type: input.type,
          body: input.body,
          dueDate: input.type === "task" ? input.dueDate : null,
          done: false,
          ...parentFields(parent),
        },
        select: { id: true },
      });
    });
  } catch (error) {
    // Родителя удалили между проверкой и вставкой — внешний ключ отклоняет запись.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new DomainError(PARENT_NOT_FOUND_MESSAGE);
    }
    throw error;
  }
}

/**
 * Отмечает задачу выполненной или снова открытой. Условие `type = task` в самом UPDATE:
 * заметку отметить нельзя ни при каких данных запроса. Возвращает родителя для обновления карточки.
 */
export async function setTaskDone({ id, done }: TaskDoneInput): Promise<{ parent: ActivityParent }> {
  const { count } = await prisma.activity.updateMany({ where: { id, type: "task" }, data: { done } });
  const activity = await prisma.activity.findUnique({
    where: { id },
    select: { type: true, leadId: true, accountId: true, contactId: true, opportunityId: true },
  });
  if (!activity) throw new DomainError(TASK_NOT_FOUND_MESSAGE);
  if (count === 0 || activity.type !== "task") throw new DomainError(NOTE_DONE_MESSAGE);
  return { parent: activityParentOf(activity) };
}
