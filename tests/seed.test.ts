// Интеграционные тесты контрольного набора. Запускаются только через npm test (база studio_crm_agent).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { addDays, getAppTimeZone, todayInTimeZone } from "../src/lib/dates";
import { AGENT_DATABASE_NAME, databaseNameFromUrl } from "../scripts/lib/db-guards";
import { SEED_COUNTS } from "../prisma/seed/data";
import {
  EXPECTED_STAGE_KEYS,
  clearDemoData,
  countData,
  resetDatabase,
  seedEmptyDatabase,
} from "../prisma/seed/run";

const EXPECTED_STAGE_IDS = EXPECTED_STAGE_KEYS.map((key) => `stage_${key}`);

const prisma = new PrismaClient();
const today = todayInTimeZone(getAppTimeZone());

before(async () => {
  // Защита от случайного запуска мимо обёртки with-test-db.
  assert.equal(databaseNameFromUrl(process.env.DATABASE_URL ?? ""), AGENT_DATABASE_NAME);
  await resetDatabase(prisma, today);
});

after(async () => {
  await prisma.$disconnect();
});

describe("seed и reset", () => {
  test("db:seed на пустой базе создаёт 6/4/5/6/8, стадии остаются", async () => {
    await clearDemoData(prisma);
    assert.deepEqual(await countData(prisma), { leads: 0, accounts: 0, contacts: 0, opportunities: 0, activities: 0 });
    const counts = await seedEmptyDatabase(prisma, today);
    assert.deepEqual(counts, SEED_COUNTS);
    assert.equal(await prisma.stage.count(), 6);
  });

  test("повторный db:seed завершается ошибкой и не меняет данные", async () => {
    const before = await countData(prisma);
    const leadIds = (await prisma.lead.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }));
    await assert.rejects(seedEmptyDatabase(prisma, today), /База не пуста/);
    assert.deepEqual(await countData(prisma), before);
    assert.deepEqual(
      await prisma.lead.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
      leadIds,
    );
  });

  test("двойной db:reset даёт те же количества, стадии сохраняют свои id", async () => {
    await resetDatabase(prisma, today);
    const first = await countData(prisma);
    const counts = await resetDatabase(prisma, today);
    assert.deepEqual(first, SEED_COUNTS);
    assert.deepEqual(counts, SEED_COUNTS);
    const stages = await prisma.stage.findMany({ orderBy: { order: "asc" } });
    assert.deepEqual(stages.map((s) => s.id), EXPECTED_STAGE_IDS);
  });

  test("reset восстанавливает изменённые и удалённые данные", async () => {
    await prisma.activity.deleteMany({ where: { type: "note" } });
    await prisma.lead.update({ where: { id: "seed_lead_l1" }, data: { status: "disqualified" } });
    await resetDatabase(prisma, today);
    assert.deepEqual(await countData(prisma), SEED_COUNTS);
    assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: "seed_lead_l1" } })).status, "new");
  });
});

describe("контрольные значения после seed", () => {
  before(async () => {
    await resetDatabase(prisma, today);
  });

  test("KPI: всего лидов 6, открытых сделок 4, сумма 7 400 000, просроченных задач 2", async () => {
    const leads = await prisma.lead.aggregate({ _count: { _all: true } });
    const open = await prisma.opportunity.aggregate({
      where: { stage: { type: "open" } },
      _count: { _all: true },
      _sum: { amount: true },
    });
    const overdue = await prisma.activity.aggregate({
      where: { type: "task", done: false, dueDate: { lt: today } },
      _count: { _all: true },
    });
    assert.equal(leads._count._all, 6);
    assert.equal(open._count._all, 4);
    assert.equal(open._sum.amount?.toString(), "7400000");
    assert.equal(overdue._count._all, 2);
  });

  test("статусы лидов: новый 2, в работе 1, квалифицирован 1, отклонён 1, конвертирован 1", async () => {
    const rows = await prisma.lead.groupBy({ by: ["status"], _count: { _all: true } });
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    assert.deepEqual(byStatus, { new: 2, in_progress: 1, qualified: 1, disqualified: 1, converted: 1 });
  });

  test("источники лидов: сайт 2, почта 1, телефон 1, рекомендация 1, вручную 1", async () => {
    const rows = await prisma.lead.groupBy({ by: ["source"], _count: { _all: true } });
    const bySource = Object.fromEntries(rows.map((r) => [r.source, r._count._all]));
    assert.deepEqual(bySource, { site: 2, email: 1, phone: 1, referral: 1, manual: 1 });
  });

  test("сделки по стадиям: бриф 2, концепция 1, согласование 1, договор 0, выиграна 1, проиграна 1", async () => {
    const rows = await prisma.opportunity.groupBy({ by: ["stageId"], _count: { _all: true } });
    const byStage = Object.fromEntries(rows.map((r) => [r.stageId, r._count._all]));
    const counts = EXPECTED_STAGE_IDS.map((id) => byStage[id] ?? 0);
    assert.deepEqual(counts, [2, 1, 1, 0, 1, 1]);
  });

  test("задачи: 2 просроченные, 2 на сегодня, 1 запланированная, 1 выполненная; 2 заметки", async () => {
    const tasks = await prisma.activity.findMany({ where: { type: "task" } });
    const open = tasks.filter((t) => !t.done);
    const time = (d: Date | null) => d?.getTime() ?? NaN;
    assert.equal(open.filter((t) => time(t.dueDate) < today.getTime()).length, 2);
    assert.equal(open.filter((t) => time(t.dueDate) === today.getTime()).length, 2);
    assert.equal(open.filter((t) => time(t.dueDate) === addDays(today, 3).getTime()).length, 1);
    assert.equal(tasks.filter((t) => t.done).length, 1);
    assert.equal(await prisma.activity.count({ where: { type: "note" } }), 2);
  });

  test("связи контрольного набора", async () => {
    const l6 = await prisma.lead.findUniqueOrThrow({ where: { id: "seed_lead_l6" } });
    assert.equal(l6.status, "converted");
    assert.deepEqual(
      [l6.convertedAccountId, l6.convertedContactId, l6.convertedOpportunityId],
      ["seed_acc_coffee", "seed_contact_elena", "seed_deal_d5"],
    );
    const l2 = await prisma.lead.findUniqueOrThrow({ where: { id: "seed_lead_l2" } });
    assert.equal(l2.companyName, null);

    const igor = await prisma.contact.findFirstOrThrow({ where: { fullName: "Игорь Белов" } });
    assert.equal(igor.accountId, null);

    const d2 = await prisma.opportunity.findUniqueOrThrow({ where: { id: "seed_deal_d2" } });
    assert.equal(d2.amount, null);
    assert.equal(d2.contactId, null);

    const d6 = await prisma.opportunity.findUniqueOrThrow({ where: { id: "seed_deal_d6" }, include: { stage: true } });
    assert.equal(d6.stage.type, "lost");
    assert.ok(d6.lostReason && d6.lostReason.trim().length > 0);

    const d5 = await prisma.opportunity.findUniqueOrThrow({ where: { id: "seed_deal_d5" }, include: { stage: true } });
    assert.equal(d5.stage.type, "won");
    assert.ok(d5.amount && d5.contactId);

    const accountsWithoutContacts = await prisma.account.count({ where: { contacts: { none: {} } } });
    assert.equal(accountsWithoutContacts, 0);
  });

  test("у каждого лида есть email или телефон", async () => {
    assert.equal(await prisma.lead.count({ where: { email: null, phone: null } }), 0);
  });

  test("поиск без учёта регистра по кириллице: «анна» находит «Анна Соколова»", async () => {
    const found = await prisma.contact.findMany({
      where: { fullName: { contains: "анна", mode: "insensitive" } },
      select: { fullName: true },
    });
    assert.deepEqual(found.map((c) => c.fullName), ["Анна Соколова"]);
    const accounts = await prisma.account.findMany({
      where: { name: { contains: "НОРД", mode: "insensitive" } },
      select: { name: true },
    });
    assert.deepEqual(accounts.map((a) => a.name), ["Норд Металл"]);
  });
});
