// Дашборд: KPI, распределения, списки и их актуальность (Plan.md 1.10, шаг 13). Только studio_crm_agent.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { addDays, getAppTimeZone, todayInTimeZone } from "../src/lib/dates";
import { prisma } from "../src/server/db";
import { getDashboardData, OVERDUE_LIST_LIMIT } from "../src/server/queries/dashboard";
import { createActivity, setTaskDone } from "../src/server/services/activities";
import { createAccount, deleteAccount } from "../src/server/services/accounts";
import { deleteContact } from "../src/server/services/contacts";
import { changeDealStage, createDeal, deleteDeal, updateDeal } from "../src/server/services/deals";
import { convertLead } from "../src/server/services/lead-conversion";
import { createLead, deleteLead, updateLead } from "../src/server/services/leads";
import { activityCreateSchema } from "../src/server/validation/activity";
import { parseForm } from "../src/server/validation/common";
import { dealCreateSchema, dealUpdateSchema } from "../src/server/validation/deal";
import { leadSchema } from "../src/server/validation/lead";
import { leadConversionSchema } from "../src/server/validation/lead-conversion";
import { AGENT_DATABASE_NAME, databaseNameFromUrl } from "../scripts/lib/db-guards";
import { clearDemoData, resetDatabase } from "../prisma/seed/run";

const today = todayInTimeZone(getAppTimeZone());
const iso = (date: Date) => date.toISOString().slice(0, 10);

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

function input<T>(schema: Parameters<typeof parseForm<T>>[0], values: Record<string, string>): T {
  const result = parseForm(schema, form(values));
  assert.ok(result.ok, JSON.stringify(!result.ok && result.fieldErrors));
  return result.data;
}

const SEED_KPI = { leads: 6, openDeals: 4, openSum: "7400000", overdueTasks: 2 };

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

describe("дашборд: контрольные значения seed (Plan.md, шаг 04)", () => {
  test("четыре KPI", async () => {
    assert.deepEqual((await getDashboardData(today)).kpi, SEED_KPI);
  });

  test("сделки по стадиям: все шесть по порядку воронки, пустой «Договор» — 0", async () => {
    const { stages } = await getDashboardData(today);
    assert.deepEqual(
      stages.map((s) => [s.name, s.type, s.count, s.sum]),
      [
        ["Бриф", "open", 2, "1200000"],
        ["Концепция и смета", "open", 1, "2400000"],
        ["Согласование", "open", 1, "3800000"],
        ["Договор", "open", 0, "0"],
        ["Выиграна", "won", 1, "650000"],
        ["Проиграна", "lost", 1, "900000"],
      ],
    );
  });

  test("лиды по статусам и источникам — все значения enum, в порядке Plan.md", async () => {
    const { leadStatuses, leadSources } = await getDashboardData(today);
    assert.deepEqual(
      leadStatuses.map((s) => [s.status, s.count]),
      [["new", 2], ["in_progress", 1], ["qualified", 1], ["disqualified", 1], ["converted", 1]],
    );
    assert.deepEqual(
      leadSources.map((s) => [s.source, s.count]),
      [["site", 2], ["email", 1], ["phone", 1], ["referral", 1], ["manual", 1]],
    );
  });

  test("новые лиды: 5 последних по дате создания; просроченные задачи: сначала самые старые, со ссылкой на запись", async () => {
    const data = await getDashboardData(today);
    const allLeads = await prisma.lead.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true } });
    assert.deepEqual(
      data.recentLeads.map((l) => l.id),
      allLeads.slice(0, 5).map((l) => l.id),
    );
    assert.deepEqual(
      data.overdueTasks.map((t) => [t.id, iso(t.dueDate!), t.parent]),
      [
        ["seed_act_a1", iso(addDays(today, -3)), { kind: "Сделка", name: "Стенд для фармацевтической выставки", href: "/deals/seed_deal_d3" }],
        ["seed_act_a2", iso(addDays(today, -1)), { kind: "Сделка", name: "Шоурум новой линейки", href: "/deals/seed_deal_d4" }],
      ],
    );
  });
});

describe("дашборд: правила расчёта", () => {
  test("сумма Decimal без потери точности; сделка без суммы не меняет итог", async () => {
    for (const amount of ["0,10", "0,20", ""]) {
      await createDeal(input(dealCreateSchema, { name: `Копейки ${amount}`, accountId: "seed_acc_nord", stageId: "stage_contract", amount }));
    }
    const { kpi, stages } = await getDashboardData(today);
    assert.equal(kpi.openDeals, 7);
    assert.equal(kpi.openSum, "7400000.3"); // 0.1 + 0.2 в числах JS дало бы 0.30000000000000004
    assert.equal(stages.find((s) => s.id === "stage_contract")?.sum, "0.3");
  });

  test("закрытые сделки не входят в открытые: выигрыш D4 уменьшает количество и сумму", async () => {
    await changeDealStage("seed_deal_d4", { stageId: "stage_won", fromStageId: "stage_approval" });
    const { kpi, stages } = await getDashboardData(today);
    assert.equal(kpi.openDeals, 3);
    assert.equal(kpi.openSum, "3600000");
    assert.deepEqual(stages.find((s) => s.type === "won"), { id: "stage_won", name: "Выиграна", type: "won", count: 2, sum: "4450000" });
  });

  test("выполненная задача не просрочена: отметка A1 уменьшает KPI, снятие отметки возвращает", async () => {
    await setTaskDone({ id: "seed_act_a1", done: true });
    let data = await getDashboardData(today);
    assert.equal(data.kpi.overdueTasks, 1);
    assert.deepEqual(data.overdueTasks.map((t) => t.id), ["seed_act_a2"]);

    await setTaskDone({ id: "seed_act_a1", done: false });
    data = await getDashboardData(today);
    assert.equal(data.kpi.overdueTasks, 2);
  });

  test("граница дня: задача на сегодня не просрочена, завтра становится просроченной", async () => {
    assert.equal((await getDashboardData(today)).kpi.overdueTasks, 2);
    // Завтра A3 и A4 (на сегодня) просрочены, выполненная A6 — по-прежнему нет.
    const tomorrow = await getDashboardData(addDays(today, 1));
    assert.equal(tomorrow.kpi.overdueTasks, 4);
    assert.ok(!tomorrow.overdueTasks.some((t) => t.id === "seed_act_a6"));
  });

  test("«сегодня» по APP_TIME_ZONE: в 00:30 по Москве задача на вчера уже просрочена, хотя по UTC ещё «сегодня»", async () => {
    const moment = new Date("2026-11-07T21:30:00Z"); // 8 ноября 00:30 в Москве, 7 ноября 21:30 в UTC
    const moscowToday = todayInTimeZone("Europe/Moscow", moment);
    const utcToday = todayInTimeZone("UTC", moment);
    assert.equal(iso(moscowToday), "2026-11-08");
    assert.equal(iso(utcToday), "2026-11-07");

    await prisma.activity.deleteMany();
    await prisma.activity.create({ data: { type: "task", body: "Граница", dueDate: new Date("2026-11-07T00:00:00Z"), leadId: "seed_lead_l1" } });
    assert.equal((await getDashboardData(moscowToday)).kpi.overdueTasks, 1);
    assert.equal((await getDashboardData(utcToday)).kpi.overdueTasks, 0);
  });

  test(`список просроченных ограничен ${OVERDUE_LIST_LIMIT} задачами, KPI считает все`, async () => {
    for (let i = 1; i <= OVERDUE_LIST_LIMIT; i++) {
      await createActivity({ type: "contact", id: "seed_contact_igor" }, input(activityCreateSchema, { type: "task", body: `Старая ${i}`, dueDate: iso(addDays(today, -30 - i)) }));
    }
    const data = await getDashboardData(today);
    assert.equal(data.kpi.overdueTasks, OVERDUE_LIST_LIMIT + 2);
    assert.equal(data.overdueTasks.length, OVERDUE_LIST_LIMIT);
    assert.equal(data.overdueTasks[0].body, `Старая ${OVERDUE_LIST_LIMIT}`);
    assert.deepEqual(data.overdueTasks[0].parent, { kind: "Контакт", name: "Игорь Белов", href: "/contacts/seed_contact_igor" });
  });

  test("пустая база: нули, все стадии, статусы и источники на месте, списки пусты", async () => {
    await clearDemoData(prisma);
    const data = await getDashboardData(today);
    assert.deepEqual(data.kpi, { leads: 0, openDeals: 0, openSum: "0", overdueTasks: 0 });
    assert.equal(data.stages.length, 6);
    assert.ok(data.stages.every((s) => s.count === 0 && s.sum === "0"));
    assert.ok(data.leadStatuses.length === 5 && data.leadStatuses.every((s) => s.count === 0));
    assert.ok(data.leadSources.length === 5 && data.leadSources.every((s) => s.count === 0));
    assert.deepEqual(data.recentLeads, []);
    assert.deepEqual(data.overdueTasks, []);
  });
});

describe("дашборд: показатели после изменений в CRM", () => {
  test("создание, правка и удаление лида", async () => {
    const { id } = await createLead(input(leadSchema, { contactName: "Ольга Морозова", companyName: "Тестовая галерея", source: "manual", phone: "+7 900 000-99-01" }));
    let data = await getDashboardData(today);
    assert.equal(data.kpi.leads, 7);
    assert.equal(data.recentLeads[0].id, id);
    assert.equal(data.leadStatuses.find((s) => s.status === "new")?.count, 3);
    assert.equal(data.leadSources.find((s) => s.source === "manual")?.count, 2);

    await updateLead(id, input(leadSchema, { contactName: "Ольга Морозова", companyName: "Тестовая галерея", source: "referral", status: "in_progress", phone: "+7 900 000-99-01" }));
    data = await getDashboardData(today);
    assert.equal(data.leadStatuses.find((s) => s.status === "new")?.count, 2);
    assert.equal(data.leadStatuses.find((s) => s.status === "in_progress")?.count, 2);
    assert.equal(data.leadSources.find((s) => s.source === "referral")?.count, 2);

    await deleteLead(id);
    data = await getDashboardData(today);
    assert.equal(data.kpi.leads, 6);
    assert.ok(!data.recentLeads.some((l) => l.id === id));
  });

  test("конвертация лида со сделкой: статус, открытые сделки и сумма", async () => {
    await convertLead(
      "seed_lead_l4",
      input(leadConversionSchema, { fullName: "Татьяна Новикова", phone: "+7 900 000-30-04", companyMode: "new", companyName: "Северная галерея", createDeal: "on", dealName: "Экспозиция", stageId: "stage_brief", amount: "500000" }),
    );
    const data = await getDashboardData(today);
    assert.equal(data.kpi.leads, 6);
    assert.equal(data.kpi.openDeals, 5);
    assert.equal(data.kpi.openSum, "7900000");
    assert.equal(data.leadStatuses.find((s) => s.status === "qualified")?.count, 0);
    assert.equal(data.leadStatuses.find((s) => s.status === "converted")?.count, 2);
    assert.equal(data.stages[0].count, 3);
  });

  test("правка суммы сделки меняет сумму открытых", async () => {
    await updateDeal("seed_deal_d1", input(dealUpdateSchema, { name: "Стенд 72 м² на отраслевой выставке", accountId: "seed_acc_nord", contactId: "seed_contact_anna", amount: "1500000" }));
    assert.equal((await getDashboardData(today)).kpi.openSum, "7700000");
  });

  test("удаление сделки удаляет её просроченную задачу из KPI и списка", async () => {
    await deleteDeal("seed_deal_d4");
    const data = await getDashboardData(today);
    assert.equal(data.kpi.openDeals, 3);
    assert.equal(data.kpi.openSum, "3600000");
    assert.equal(data.kpi.overdueTasks, 1);
    assert.deepEqual(data.overdueTasks.map((t) => t.id), ["seed_act_a1"]);
  });

  test("удаление компании и контакта каскадно убирает их просроченные задачи", async () => {
    const { id: accountId } = await createAccount({ name: "Временная компания" });
    await createActivity({ type: "account", id: accountId }, input(activityCreateSchema, { type: "task", body: "Задача компании", dueDate: iso(addDays(today, -2)) }));
    await createActivity({ type: "contact", id: "seed_contact_igor" }, input(activityCreateSchema, { type: "task", body: "Задача контакта", dueDate: iso(addDays(today, -2)) }));
    assert.equal((await getDashboardData(today)).kpi.overdueTasks, 4);

    await deleteAccount(accountId);
    assert.equal((await getDashboardData(today)).kpi.overdueTasks, 3);
    await deleteContact("seed_contact_igor");
    assert.equal((await getDashboardData(today)).kpi.overdueTasks, 2);
  });
});
