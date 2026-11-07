// Заметки и задачи: Zod, сервис, состояние по сроку и APP_TIME_ZONE (Plan.md 1.7, шаг 12). Только studio_crm_agent.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { relativeDueLabel, taskState } from "../src/lib/activities";
import { addDays, getAppTimeZone, todayInTimeZone } from "../src/lib/dates";
import { prisma } from "../src/server/db";
import { DomainError } from "../src/server/errors";
import { listActivities, overdueTaskWhere } from "../src/server/queries/activities";
import { getPipeline } from "../src/server/queries/deals";
import {
  createActivity,
  LEAD_CONVERTED_MESSAGE,
  NOTE_DONE_MESSAGE,
  PARENT_NOT_FOUND_MESSAGE,
  setTaskDone,
  TASK_NOT_FOUND_MESSAGE,
} from "../src/server/services/activities";
import { convertLead } from "../src/server/services/lead-conversion";
import {
  activityCreateSchema,
  activityParentSchema,
  BODY_REQUIRED_MESSAGE,
  DUE_DATE_REQUIRED_MESSAGE,
  taskDoneSchema,
  type ActivityCreateInput,
} from "../src/server/validation/activity";
import { parseForm } from "../src/server/validation/common";
import { leadConversionSchema } from "../src/server/validation/lead-conversion";
import { AGENT_DATABASE_NAME, databaseNameFromUrl } from "../scripts/lib/db-guards";
import { resetDatabase } from "../prisma/seed/run";

const timeZone = getAppTimeZone();
const today = todayInTimeZone(timeZone);

const ID = {
  l1: "seed_lead_l1",
  l3: "seed_lead_l3",
  l6: "seed_lead_l6", // конвертирован
  nord: "seed_acc_nord",
  vector: "seed_acc_vector",
  maria: "seed_contact_maria",
  d1: "seed_deal_d1",
  d3: "seed_deal_d3",
  d4: "seed_deal_d4",
  d5: "seed_deal_d5",
  a1: "seed_act_a1", // задача D3, просрочена на 3 дня
  a3: "seed_act_a3", // задача D1, на сегодня
  a6: "seed_act_a6", // задача D5, выполнена
  a7: "seed_act_a7", // заметка D4
};

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

function parsed(values: Record<string, string>): ActivityCreateInput {
  const result = parseForm(activityCreateSchema, form(values));
  assert.ok(result.ok, JSON.stringify(!result.ok && result.fieldErrors));
  return result.data;
}

function convertInput(values: Record<string, string>) {
  const result = parseForm(leadConversionSchema, form(values));
  assert.ok(result.ok, JSON.stringify(!result.ok && result.fieldErrors));
  return result.data;
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

const refused = (message: string) => (error: unknown) => {
  assert.ok(error instanceof DomainError, String(error));
  assert.equal(error.message, message);
  return true;
};

before(() => {
  assert.equal(databaseNameFromUrl(process.env.DATABASE_URL ?? ""), AGENT_DATABASE_NAME);
});
beforeEach(async () => {
  await resetDatabase(prisma, today);
});
after(async () => {
  await resetDatabase(prisma, today);
  await prisma.$disconnect();
});

describe("активности: Zod", () => {
  test("заметка: текст обязателен, пробелы обрезаются, срок отбрасывается", () => {
    const empty = parseForm(activityCreateSchema, form({ type: "note", body: "   " }));
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.deepEqual(empty.fieldErrors, { body: BODY_REQUIRED_MESSAGE });

    assert.deepEqual(parsed({ type: "note", body: "  Позвонить  ", dueDate: "2026-11-10" }), {
      type: "note",
      body: "Позвонить",
      dueDate: undefined,
    });
  });

  test("задача: срок обязателен, несуществующая и неверно записанная дата отклоняются", () => {
    const noDate = parseForm(activityCreateSchema, form({ type: "task", body: "Созвон", dueDate: "" }));
    assert.equal(noDate.ok, false);
    if (!noDate.ok) assert.deepEqual(noDate.fieldErrors, { dueDate: DUE_DATE_REQUIRED_MESSAGE });

    for (const dueDate of ["2026-02-30", "10.11.2026", "завтра"]) {
      const bad = parseForm(activityCreateSchema, form({ type: "task", body: "Созвон", dueDate }));
      assert.equal(bad.ok, false, dueDate);
      if (!bad.ok) assert.deepEqual(Object.keys(bad.fieldErrors), ["dueDate"]);
    }

    const good = parsed({ type: "task", body: "Созвон", dueDate: "2026-11-10" });
    assert.equal(good.dueDate?.toISOString(), "2026-11-10T00:00:00.000Z");
  });

  test("тип только note или task, текст до 2000 символов", () => {
    const bad = parseForm(activityCreateSchema, form({ type: "call", body: "я".repeat(2001) }));
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.deepEqual(Object.keys(bad.fieldErrors).sort(), ["body", "type"]);
    assert.equal(parseForm(activityCreateSchema, form({ body: "Текст" })).ok, false);
  });

  test("родитель — один из четырёх типов; отметка — булево значение", () => {
    assert.equal(activityParentSchema.safeParse({ type: "opportunity", id: ID.d1 }).success, true);
    assert.equal(activityParentSchema.safeParse({ type: "stage", id: "stage_brief" }).success, false);
    assert.equal(activityParentSchema.safeParse({ type: "lead", id: "" }).success, false);

    assert.deepEqual(parseForm(taskDoneSchema, form({ id: ID.a3, done: "true" })), { ok: true, data: { id: ID.a3, done: true } });
    assert.deepEqual(parseForm(taskDoneSchema, form({ id: ID.a3, done: "false" })), { ok: true, data: { id: ID.a3, done: false } });
    assert.equal(parseForm(taskDoneSchema, form({ id: ID.a3, done: "да" })).ok, false);
    assert.equal(parseForm(taskDoneSchema, form({ done: "true" })).ok, false);
  });
});

describe("активности: создание у каждого типа родителя", () => {
  const parents = [
    { type: "lead", id: ID.l1, field: "leadId" },
    { type: "account", id: ID.nord, field: "accountId" },
    { type: "contact", id: ID.maria, field: "contactId" },
    { type: "opportunity", id: ID.d1, field: "opportunityId" },
  ] as const;

  for (const parent of parents) {
    test(`${parent.type}: заметка и задача привязаны ровно к нему`, async () => {
      const note = await createActivity(parent, parsed({ type: "note", body: "Заметка" }));
      const task = await createActivity(parent, parsed({ type: "task", body: "Задача", dueDate: iso(addDays(today, 2)) }));

      const rows = await prisma.activity.findMany({ where: { id: { in: [note.id, task.id] } }, orderBy: { type: "asc" } });
      assert.equal(rows.length, 2);
      for (const row of rows) {
        const filled = (["leadId", "accountId", "contactId", "opportunityId"] as const).filter((key) => row[key] !== null);
        assert.deepEqual(filled, [parent.field]);
        assert.equal(row[parent.field], parent.id);
        assert.equal(row.done, false);
      }
      const [savedNote, savedTask] = rows;
      assert.equal(savedNote.type, "note");
      assert.equal(savedNote.dueDate, null);
      assert.equal(savedTask.type, "task");
      assert.equal(iso(savedTask.dueDate!), iso(addDays(today, 2)));
    });
  }

  test("несуществующий родитель — понятная ошибка, ничего не создано", async () => {
    const before = await prisma.activity.count();
    for (const type of ["lead", "account", "contact", "opportunity"] as const) {
      await assert.rejects(createActivity({ type, id: "missing" }, parsed({ type: "note", body: "Текст" })), refused(PARENT_NOT_FOUND_MESSAGE));
    }
    assert.equal(await prisma.activity.count(), before);
  });

  test("у конвертированного лида новая активность отклоняется", async () => {
    const before = await prisma.activity.count();
    await assert.rejects(createActivity({ type: "lead", id: ID.l6 }, parsed({ type: "note", body: "Текст" })), refused(LEAD_CONVERTED_MESSAGE));
    assert.equal(await prisma.activity.count(), before);
  });

  test("дата срока сохраняется той же календарной датой (без сдвига часового пояса)", async () => {
    for (const day of ["2026-01-01", "2026-03-29", "2026-10-25", "2026-12-31"]) {
      const { id } = await createActivity({ type: "contact", id: ID.maria }, parsed({ type: "task", body: day, dueDate: day }));
      const row = await prisma.activity.findUniqueOrThrow({ where: { id } });
      assert.equal(iso(row.dueDate!), day);
    }
  });
});

describe("активности: отметка выполнения", () => {
  test("задача → выполнена → снова не выполнена; возвращается родитель", async () => {
    assert.deepEqual(await setTaskDone({ id: ID.a3, done: true }), { parent: { type: "opportunity", id: ID.d1 } });
    assert.equal((await prisma.activity.findUniqueOrThrow({ where: { id: ID.a3 } })).done, true);

    assert.deepEqual(await setTaskDone({ id: ID.a3, done: false }), { parent: { type: "opportunity", id: ID.d1 } });
    assert.equal((await prisma.activity.findUniqueOrThrow({ where: { id: ID.a3 } })).done, false);
  });

  test("заметку нельзя отметить выполненной, она не меняется", async () => {
    const before = await prisma.activity.findUniqueOrThrow({ where: { id: ID.a7 } });
    await assert.rejects(setTaskDone({ id: ID.a7, done: true }), refused(NOTE_DONE_MESSAGE));
    assert.deepEqual(await prisma.activity.findUniqueOrThrow({ where: { id: ID.a7 } }), before);
  });

  test("несуществующая задача — понятная ошибка", async () => {
    await assert.rejects(setTaskDone({ id: "missing", done: true }), refused(TASK_NOT_FOUND_MESSAGE));
  });
});

describe("задачи: сегодня и просрочено (APP_TIME_ZONE)", () => {
  const due = (offset: number, done = false) => ({ dueDate: addDays(today, offset), done });

  test("taskState: вчера — просрочена, сегодня — на сегодня, завтра — запланирована, выполненная — не просрочена", () => {
    assert.equal(taskState(due(-1), today), "overdue");
    assert.equal(taskState(due(-30), today), "overdue");
    assert.equal(taskState(due(0), today), "today");
    assert.equal(taskState(due(1), today), "planned");
    assert.equal(taskState(due(-5, true), today), "done");
    assert.equal(taskState(due(0, true), today), "done");
  });

  test("подписи срока со склонением", () => {
    assert.equal(relativeDueLabel(due(-1), today), "Просрочено на 1 день");
    assert.equal(relativeDueLabel(due(-3), today), "Просрочено на 3 дня");
    assert.equal(relativeDueLabel(due(-5), today), "Просрочено на 5 дней");
    assert.equal(relativeDueLabel(due(-21), today), "Просрочено на 21 день");
    assert.equal(relativeDueLabel(due(0), today), "Сегодня");
    assert.equal(relativeDueLabel(due(1), today), "Завтра");
    assert.equal(relativeDueLabel(due(3), today), null);
    assert.equal(relativeDueLabel(due(-3, true), today), null);
  });

  test("«сегодня» зависит от APP_TIME_ZONE, а не от часового пояса процесса", () => {
    // 7 ноября 2026, 22:30 UTC: в Москве (UTC+3) уже 8 ноября, в Лос-Анджелесе ещё 7-е.
    const moment = new Date("2026-11-07T22:30:00.000Z");
    const moscow = todayInTimeZone("Europe/Moscow", moment);
    const losAngeles = todayInTimeZone("America/Los_Angeles", moment);
    assert.equal(iso(moscow), "2026-11-08");
    assert.equal(iso(losAngeles), "2026-11-07");

    const task = { dueDate: new Date("2026-11-07T00:00:00.000Z"), done: false };
    assert.equal(taskState(task, moscow), "overdue");
    assert.equal(taskState(task, losAngeles), "today");
  });

  test("запрос overdueTaskWhere совпадает с taskState: в контрольных данных просрочены A1 и A2", async () => {
    const overdue = await prisma.activity.findMany({ where: overdueTaskWhere(today), orderBy: { dueDate: "asc" }, select: { id: true } });
    assert.deepEqual(overdue.map((a) => a.id), [ID.a1, "seed_act_a2"]);

    const all = await prisma.activity.findMany({ where: { type: "task" } });
    const byState = all.filter((a) => taskState({ dueDate: a.dueDate!, done: a.done }, today) === "overdue").map((a) => a.id).sort();
    assert.deepEqual(byState, [ID.a1, "seed_act_a2"]);

    // Выполнение убирает задачу из просроченных, возврат в работу — возвращает.
    await setTaskDone({ id: ID.a1, done: true });
    assert.equal(await prisma.activity.count({ where: overdueTaskWhere(today) }), 1);
    await setTaskDone({ id: ID.a1, done: false });
    assert.equal(await prisma.activity.count({ where: overdueTaskWhere(today) }), 2);
  });
});

describe("доска воронки: бейдж «Просрочено»", () => {
  const overdueDeals = async () =>
    (await getPipeline(today)).flatMap((column) => column.deals.filter((deal) => deal.overdue).map((deal) => deal.id)).sort();

  test("просрочены задачи D3 и D4; выполнение задачи и задача на сегодня бейдж не дают", async () => {
    assert.deepEqual(await overdueDeals(), [ID.d3, ID.d4]);
    await setTaskDone({ id: ID.a1, done: true });
    assert.deepEqual(await overdueDeals(), [ID.d4]);
    // D1 с задачей на сегодня (A3) и D5 с выполненной просроченной (A6) — без бейджа.
    await createActivity({ type: "opportunity", id: ID.d1 }, parsed({ type: "task", body: "Вчера", dueDate: iso(addDays(today, -1)) }));
    assert.deepEqual(await overdueDeals(), [ID.d1, ID.d4]);
  });
});

describe("лента активностей карточки", () => {
  test("невыполненные задачи по сроку, затем остальное — новые сверху; состояние и подписи посчитаны", async () => {
    const parent = { type: "opportunity", id: ID.d4 } as const; // A2 (просрочена) и A7 (заметка)
    await createActivity(parent, parsed({ type: "task", body: "Позже", dueDate: iso(addDays(today, 5)) }));
    await createActivity(parent, parsed({ type: "task", body: "Сегодня", dueDate: iso(today) }));
    const done = await createActivity(parent, parsed({ type: "task", body: "Готово", dueDate: iso(addDays(today, -2)) }));
    await setTaskDone({ id: done.id, done: true });
    await createActivity(parent, parsed({ type: "note", body: "Новая заметка" }));

    const feed = await listActivities(parent, today, timeZone);
    assert.deepEqual(
      feed.map((a) => [a.body, a.done ? "done" : a.dueState]),
      [
        ["Уточнить замечания по смете шоурума", "overdue"],
        ["Сегодня", "today"],
        ["Позже", "planned"],
        ["Новая заметка", null],
        ["Готово", "done"],
        ["Клиент просит два варианта планировки", null],
      ],
    );
    assert.equal(feed[0].relativeLabel, "Просрочено на 1 день");
    assert.equal(feed[1].relativeLabel, "Сегодня");
    assert.equal(feed[3].dueLabel, null);
  });

  test("лента лида L3 показывает задачу на сегодня; активности других записей не попадают", async () => {
    const feed = await listActivities({ type: "lead", id: ID.l3 }, today, timeZone);
    assert.deepEqual(feed.map((a) => [a.body, a.dueState, a.relativeLabel]), [["Перезвонить и уточнить площадку", "today", "Сегодня"]]);
    assert.deepEqual(await listActivities({ type: "lead", id: ID.l1 }, today, timeZone), []);
  });

  test("после конвертации активности лида видны в ленте сделки, без сделки — в ленте контакта", async () => {
    // L3 с задачей на сегодня → сделка.
    const withDeal = await convertLead(
      ID.l3,
      convertInput({ fullName: "Ольга", phone: "+7 900 000-00-01", companyMode: "new", companyName: "Тест", createDeal: "on", dealName: "Стенд", stageId: "stage_brief" }),
    );
    assert.deepEqual(await listActivities({ type: "lead", id: ID.l3 }, today, timeZone), []);
    const dealFeed = await listActivities({ type: "opportunity", id: withDeal.opportunityId! }, today, timeZone);
    assert.deepEqual(dealFeed.map((a) => [a.body, a.dueState]), [["Перезвонить и уточнить площадку", "today"]]);

    // L1 с новой заметкой и задачей → только контакт.
    await createActivity({ type: "lead", id: ID.l1 }, parsed({ type: "note", body: "Заметка лида" }));
    await createActivity({ type: "lead", id: ID.l1 }, parsed({ type: "task", body: "Задача лида", dueDate: iso(addDays(today, 1)) }));
    const noDeal = await convertLead(ID.l1, convertInput({ fullName: "Павел", phone: "+7 900 000-00-02", companyMode: "existing", accountId: ID.nord }));
    const contactFeed = await listActivities({ type: "contact", id: noDeal.contactId }, today, timeZone);
    assert.deepEqual(contactFeed.map((a) => [a.body, a.dueState, a.relativeLabel]), [
      ["Задача лида", "planned", "Завтра"],
      ["Заметка лида", null, null],
    ]);
  });

  test("создание активности параллельно с конвертацией: активность не остаётся у конвертированного лида", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await resetDatabase(prisma, today);
      const results = await Promise.allSettled([
        convertLead(ID.l1, convertInput({ fullName: "Павел", phone: "+7 900 000-00-02", companyMode: "existing", accountId: ID.nord })),
        createActivity({ type: "lead", id: ID.l1 }, parsed({ type: "task", body: "Гонка", dueDate: iso(today) })),
      ]);
      assert.equal(results[0].status, "fulfilled");
      assert.equal(await prisma.activity.count({ where: { leadId: ID.l1 } }), 0);
      const created = results[1].status === "fulfilled";
      if (!created) assert.ok(refused(LEAD_CONVERTED_MESSAGE)((results[1] as PromiseRejectedResult).reason));
      // Если активность успела создаться до конвертации, она перенесена на контакт.
      assert.equal(await prisma.activity.count({ where: { body: "Гонка" } }), created ? 1 : 0);
    }
  });
});
