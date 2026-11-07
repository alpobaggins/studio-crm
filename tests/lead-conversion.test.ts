// Конвертация лида: Zod, транзакция, защита от повторных и параллельных вызовов, перенос активностей
// (Plan.md 1.6, шаг 10). Только studio_crm_agent.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { getAppTimeZone, todayInTimeZone } from "../src/lib/dates";
import { prisma } from "../src/server/db";
import { DomainError } from "../src/server/errors";
import { deleteContact } from "../src/server/services/contacts";
import {
  ACCOUNT_NOT_FOUND_MESSAGE,
  ALREADY_CONVERTED_MESSAGE,
  convertLead,
  DISQUALIFIED_MESSAGE,
  LEAD_NOT_FOUND_MESSAGE,
  OPEN_STAGE_MESSAGE,
} from "../src/server/services/lead-conversion";
import { parseForm } from "../src/server/validation/common";
import { leadConversionSchema, type LeadConversionInput } from "../src/server/validation/lead-conversion";
import { AGENT_DATABASE_NAME, databaseNameFromUrl } from "../scripts/lib/db-guards";
import { resetDatabase } from "../prisma/seed/run";

const today = todayInTimeZone(getAppTimeZone());
const L1 = "seed_lead_l1";
const L2 = "seed_lead_l2";
const L3 = "seed_lead_l3";
const L4 = "seed_lead_l4";
const L5 = "seed_lead_l5";
const L6 = "seed_lead_l6";
const NORD = "seed_acc_nord";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

/** Разбор формы, как в action; для неуспешного разбора тест падает. */
function input(values: Record<string, string>): LeadConversionInput {
  const parsed = parseForm(leadConversionSchema, form(values));
  assert.equal(parsed.ok, true, parsed.ok ? "" : JSON.stringify(parsed.fieldErrors));
  if (!parsed.ok) throw new Error("unreachable");
  return parsed.data;
}

const newCompanyNoDeal = { fullName: "Павел Смирнов", phone: "+7 900 000-30-01", companyMode: "new", companyName: "Арктик Тех" };

/** Полный снимок всех таблиц: «ничего не изменилось» проверяется сравнением снимков до и после. */
async function snapshot() {
  const order = { orderBy: { id: "asc" as const } };
  const tables = await Promise.all([
    prisma.lead.findMany(order),
    prisma.account.findMany(order),
    prisma.contact.findMany(order),
    prisma.opportunity.findMany(order),
    prisma.activity.findMany(order),
    prisma.stage.findMany(order),
  ]);
  return JSON.stringify(tables);
}

const rejectsWith = (message: string, fieldErrors?: Record<string, string>) => (error: unknown) => {
  assert.ok(error instanceof DomainError, String(error));
  assert.equal(error.message, message);
  if (fieldErrors) assert.deepEqual(error.fieldErrors, fieldErrors);
  return true;
};

async function addLeadActivities(leadId: string) {
  // Заметка, открытая задача и выполненная задача — чтобы проверить сохранение текста, срока и отметки.
  await prisma.activity.createMany({
    data: [
      { id: "t_note", type: "note", body: "Просил перезвонить после обеда", leadId },
      { id: "t_task_open", type: "task", body: "Отправить портфолио", dueDate: new Date("2026-12-01T00:00:00.000Z"), leadId },
      { id: "t_task_done", type: "task", body: "Первый звонок", dueDate: new Date("2026-11-01T00:00:00.000Z"), done: true, leadId },
    ],
  });
  return prisma.activity.findMany({ where: { leadId }, orderBy: { id: "asc" }, select: { id: true, type: true, body: true, dueDate: true, done: true } });
}

before(() => {
  assert.equal(databaseNameFromUrl(process.env.DATABASE_URL ?? ""), AGENT_DATABASE_NAME);
});
beforeEach(async () => {
  await resetDatabase(prisma, today);
});
after(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_opportunity_insert ON "Opportunity"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS test_fail_opportunity_insert()`);
  await resetDatabase(prisma, today);
  await prisma.$disconnect();
});

describe("конвертация: валидация Zod", () => {
  test("режим компании не указан или неизвестен — ошибка у переключателя", () => {
    for (const companyMode of [undefined, "", "none", "NEW"]) {
      const values: Record<string, string> = { fullName: "Имя", phone: "+7 900 000-00-00", companyName: "Компания" };
      if (companyMode !== undefined) values.companyMode = companyMode;
      const result = parseForm(leadConversionSchema, form(values));
      assert.equal(result.ok, false, `режим ${companyMode}`);
      if (!result.ok) assert.equal(result.fieldErrors.companyMode, "Выберите: новая компания или существующая");
    }
  });

  test("ошибки контакта, компании и сделки показываются вместе", () => {
    const result = parseForm(leadConversionSchema, form({ fullName: " ", companyMode: "new", companyName: " ", createDeal: "on", dealName: "", stageId: "", amount: "-5" }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.fieldErrors, {
        fullName: "Укажите имя контакта",
        email: "Укажите телефон или email",
        phone: "Укажите телефон или email",
        companyName: "Укажите название новой компании",
        dealName: "Укажите название сделки",
        stageId: "Выберите стадию",
        amount: "Сумма: число в рублях, например 1500000 или 1500000,50",
      });
    }
  });

  test("режим «существующая» требует компанию; поля сделки без отметки не проверяются", () => {
    const result = parseForm(leadConversionSchema, form({ fullName: "Имя", email: "a@example.com", companyMode: "existing", accountId: "", dealName: "" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(result.fieldErrors, { accountId: "Выберите компанию" });
  });

  test("сумма с пробелами и запятой; лишние поля другого режима отбрасываются", () => {
    const data = input({ fullName: "Имя", email: "a@example.com", companyMode: "existing", accountId: NORD, companyName: "Лишнее", createDeal: "on", dealName: "Сделка", stageId: "stage_brief", amount: "1 500 000,5" });
    assert.equal(data.companyMode, "existing");
    assert.ok(data.createDeal);
    assert.equal("companyName" in data, false);
    if (data.createDeal) assert.equal(data.amount, "1500000.5");
  });
});

describe("конвертация: успешные сценарии", () => {
  test("новая компания без сделки: компания, контакт, лид converted со ссылками, активности на контакте", async () => {
    const before = await prisma.account.count();
    const activities = await addLeadActivities(L1);
    const result = await convertLead(L1, input(newCompanyNoDeal));

    assert.equal(await prisma.account.count(), before + 1);
    const account = await prisma.account.findUniqueOrThrow({ where: { id: result.accountId } });
    assert.equal(account.name, "Арктик Тех");
    const contact = await prisma.contact.findUniqueOrThrow({ where: { id: result.contactId } });
    assert.deepEqual(
      { fullName: contact.fullName, phone: contact.phone, email: contact.email, accountId: contact.accountId },
      { fullName: "Павел Смирнов", phone: "+7 900 000-30-01", email: null, accountId: result.accountId },
    );
    assert.equal(result.opportunityId, null);
    assert.equal(await prisma.opportunity.count({ where: { contactId: result.contactId } }), 0);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: L1 } });
    assert.equal(lead.status, "converted");
    assert.ok(lead.convertedAt);
    assert.deepEqual(
      [lead.convertedAccountId, lead.convertedContactId, lead.convertedOpportunityId],
      [result.accountId, result.contactId, null],
    );

    assert.equal(result.movedActivities, 3);
    assert.equal(result.activitiesMovedTo, "contact");
    const moved = await prisma.activity.findMany({ where: { id: { in: activities.map((a) => a.id) } }, orderBy: { id: "asc" } });
    for (const [i, activity] of moved.entries()) {
      assert.deepEqual(
        { id: activity.id, type: activity.type, body: activity.body, dueDate: activity.dueDate, done: activity.done },
        activities[i],
      );
      // Ровно один родитель — новый контакт.
      assert.deepEqual(
        [activity.leadId, activity.accountId, activity.contactId, activity.opportunityId],
        [null, null, result.contactId, null],
      );
    }
  });

  test("новая компания со сделкой: сделка в открытой стадии со связями, данными лида и активностями", async () => {
    const activities = await prisma.activity.findMany({ where: { leadId: L3 } });
    assert.equal(activities.length, 1); // A4 — задача на сегодня
    const result = await convertLead(
      L3,
      input({ fullName: "Сергей Волков", phone: "+7 900 000-30-03", companyMode: "new", companyName: "Волков и партнёры", createDeal: "on", dealName: "Бренд-зона — Волков и партнёры", stageId: "stage_concept", amount: "450 000" }),
    );
    assert.ok(result.opportunityId);
    const deal = await prisma.opportunity.findUniqueOrThrow({ where: { id: result.opportunityId }, include: { stage: true } });
    assert.equal(deal.name, "Бренд-зона — Волков и партнёры");
    assert.equal(deal.accountId, result.accountId);
    assert.equal(deal.contactId, result.contactId);
    assert.equal(deal.stage.key, "concept");
    assert.equal(deal.stage.type, "open");
    assert.equal(deal.amount?.toString(), "450000");
    assert.equal(deal.workFormat, "Бренд-зона");
    assert.equal(deal.closedAt, null);
    assert.equal(deal.lostReason, null);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: L3 } });
    assert.equal(lead.convertedOpportunityId, result.opportunityId);

    assert.equal(result.movedActivities, 1);
    assert.equal(result.activitiesMovedTo, "opportunity");
    const moved = await prisma.activity.findUniqueOrThrow({ where: { id: activities[0].id } });
    assert.deepEqual(
      [moved.leadId, moved.accountId, moved.contactId, moved.opportunityId],
      [null, null, null, result.opportunityId],
    );
    assert.deepEqual([moved.body, moved.dueDate, moved.done], [activities[0].body, activities[0].dueDate, activities[0].done]);
  });

  test("существующая компания без сделки: число компаний не меняется, контакт связан с выбранной", async () => {
    const before = await prisma.account.count();
    const result = await convertLead(L1, input({ ...newCompanyNoDeal, companyMode: "existing", accountId: NORD }));
    assert.equal(await prisma.account.count(), before);
    assert.equal(result.accountId, NORD);
    const contact = await prisma.contact.findUniqueOrThrow({ where: { id: result.contactId } });
    assert.equal(contact.accountId, NORD);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: L1 } });
    assert.equal(lead.convertedAccountId, NORD);
  });

  test("существующая компания со сделкой: сумма из бюджета, сделка и контакт связаны с выбранной", async () => {
    const before = await prisma.account.count();
    const activities = await addLeadActivities(L4);
    const result = await convertLead(
      L4,
      input({ fullName: "Татьяна Новикова", email: "t.novikova@sever-gallery.example.com", phone: "+7 900 000-30-04", companyMode: "existing", accountId: NORD, createDeal: "on", dealName: "Пространство — Северная галерея", stageId: "stage_brief", amount: "800000.00" }),
    );
    assert.equal(await prisma.account.count(), before);
    assert.ok(result.opportunityId);
    const deal = await prisma.opportunity.findUniqueOrThrow({ where: { id: result.opportunityId } });
    assert.deepEqual([deal.accountId, deal.contactId, deal.amount?.toString()], [NORD, result.contactId, "800000"]);
    assert.equal(deal.venue, "Выставочный зал");
    assert.ok(deal.eventDate);
    assert.equal(result.movedActivities, 3);
    const moved = await prisma.activity.findMany({ where: { id: { in: activities.map((a) => a.id) } } });
    assert.ok(moved.every((a) => a.opportunityId === result.opportunityId && !a.leadId && !a.contactId && !a.accountId));
    assert.equal(await prisma.activity.count({ where: { leadId: L4 } }), 0);
  });

  test("лид в статусе «Новый», «В работе» и «Квалифицирован» конвертируется (квалификация не требуется)", async () => {
    for (const leadId of [L1, L3, L4]) {
      const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
      await convertLead(leadId, input({ fullName: lead.contactName, email: "x@example.com", companyMode: "existing", accountId: NORD }));
      assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).status, "converted");
    }
  });
});

describe("конвертация: отказы без частичных изменений", () => {
  test("новая компания без названия (L2) — отклонено Zod и сервисом, ничего не изменилось", async () => {
    const values = { fullName: "Ольга Лебедева", email: "olga.lebedeva@example.com", companyMode: "new", companyName: "" };
    const parsed = parseForm(leadConversionSchema, form(values));
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.deepEqual(parsed.fieldErrors, { companyName: "Укажите название новой компании" });

    const snap = await snapshot();
    // В обход схемы Zod — правило действует и в сервисе.
    const bypass = { fullName: "Ольга Лебедева", email: "olga.lebedeva@example.com", companyMode: "new", companyName: "  ", createDeal: false } as LeadConversionInput;
    await assert.rejects(convertLead(L2, bypass), rejectsWith("Проверьте выделенные поля.", { companyName: "Укажите название новой компании" }));
    assert.equal(await snapshot(), snap);
  });

  test("без email и телефона — отклонено, ничего не изменилось", async () => {
    const parsed = parseForm(leadConversionSchema, form({ fullName: "Павел Смирнов", companyMode: "new", companyName: "Арктик Тех" }));
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.deepEqual(parsed.fieldErrors, { email: "Укажите телефон или email", phone: "Укажите телефон или email" });

    const snap = await snapshot();
    const bypass = { fullName: "Павел Смирнов", companyMode: "new", companyName: "Арктик Тех", createDeal: false } as LeadConversionInput;
    await assert.rejects(
      convertLead(L1, bypass),
      rejectsWith("Проверьте выделенные поля.", { email: "Укажите телефон или email", phone: "Укажите телефон или email" }),
    );
    assert.equal(await snapshot(), snap);
  });

  test("неизвестный режим компании в обход Zod — отклонено, ничего не изменилось", async () => {
    const snap = await snapshot();
    for (const createDeal of [false, true]) {
      const bypass = { fullName: "Павел Смирнов", phone: "+7 900 000-30-01", companyMode: "none", createDeal, dealName: "Сделка", stageId: "stage_brief" } as unknown as LeadConversionInput;
      await assert.rejects(convertLead(L1, bypass), rejectsWith("Проверьте выделенные поля.", { companyMode: "Выберите: новая компания или существующая" }));
    }
    assert.equal(await snapshot(), snap);
  });

  test("существующая компания, которой нет, — со сделкой и без: отклонено, лид в прежнем статусе", async () => {
    const snap = await snapshot();
    for (const deal of [{}, { createDeal: "on", dealName: "Сделка", stageId: "stage_brief" }] as Record<string, string>[]) {
      await assert.rejects(
        convertLead(L1, input({ ...newCompanyNoDeal, companyMode: "existing", accountId: "missing_account", ...deal })),
        rejectsWith("Проверьте выделенные поля.", { accountId: ACCOUNT_NOT_FOUND_MESSAGE }),
      );
    }
    assert.equal(await snapshot(), snap);
    assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: L1 } })).status, "new");
  });

  test("отклонённый лид (L5) — отклонено с объяснением, ничего не изменилось", async () => {
    const snap = await snapshot();
    await assert.rejects(
      convertLead(L5, input({ fullName: "Андрей Козлов", phone: "+7 900 000-30-05", companyMode: "new", companyName: "Козлов Трейд" })),
      rejectsWith(DISQUALIFIED_MESSAGE),
    );
    assert.equal(await snapshot(), snap);
  });

  test("несуществующий лид — понятная ошибка, ничего не создано", async () => {
    const snap = await snapshot();
    await assert.rejects(convertLead("missing_lead", input(newCompanyNoDeal)), rejectsWith(LEAD_NOT_FOUND_MESSAGE));
    assert.equal(await snapshot(), snap);
  });

  test("уже конвертированный лид (L6) — отклонено", async () => {
    const snap = await snapshot();
    await assert.rejects(
      convertLead(L6, input({ fullName: "Елена Гусева", email: "elena@coffee-lab.example.com", companyMode: "new", companyName: "Кофе Лаб" })),
      rejectsWith(ALREADY_CONVERTED_MESSAGE),
    );
    assert.equal(await snapshot(), snap);
  });

  test("повторный вызов после успешной конвертации — отклонено, новых записей нет", async () => {
    await convertLead(L1, input({ ...newCompanyNoDeal, createDeal: "on", dealName: "Стенд", stageId: "stage_brief" }));
    const snap = await snapshot();
    await assert.rejects(convertLead(L1, input(newCompanyNoDeal)), rejectsWith(ALREADY_CONVERTED_MESSAGE));
    assert.equal(await snapshot(), snap);
  });

  test("после удаления созданного контакта лид остаётся конвертированным и снова не конвертируется", async () => {
    const result = await convertLead(L1, input(newCompanyNoDeal));
    await deleteContact(result.contactId);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: L1 } });
    assert.equal(lead.status, "converted");
    assert.equal(lead.convertedContactId, null);
    const snap = await snapshot();
    await assert.rejects(convertLead(L1, input(newCompanyNoDeal)), rejectsWith(ALREADY_CONVERTED_MESSAGE));
    assert.equal(await snapshot(), snap);
  });
});

describe("конвертация: атомарность и параллельные вызовы", () => {
  test("закрытая стадия сделки — ошибка после создания компании и контакта откатывает всё", async () => {
    const activities = await addLeadActivities(L1);
    const snap = await snapshot();
    for (const stageId of ["stage_won", "stage_lost"]) {
      await assert.rejects(
        convertLead(L1, input({ ...newCompanyNoDeal, createDeal: "on", dealName: "Стенд", stageId })),
        rejectsWith("Проверьте выделенные поля.", { stageId: OPEN_STAGE_MESSAGE }),
      );
    }
    assert.equal(await snapshot(), snap);
    assert.equal(await prisma.activity.count({ where: { leadId: L1 } }), activities.length);
  });

  test("искусственный сбой базы при создании сделки: нет новых записей, лид в прежнем статусе, активности на месте", async () => {
    const activities = await addLeadActivities(L4);
    const snap = await snapshot();
    // Триггер только в studio_crm_agent и только на время теста: любая вставка сделки падает с ошибкой PostgreSQL.
    await prisma.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION test_fail_opportunity_insert() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$ LANGUAGE plpgsql`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER test_fail_opportunity_insert BEFORE INSERT ON "Opportunity" FOR EACH ROW EXECUTE FUNCTION test_fail_opportunity_insert()`,
    );
    try {
      await assert.rejects(
        convertLead(L4, input({ fullName: "Татьяна Новикова", email: "t@example.com", companyMode: "new", companyName: "Северная галерея", createDeal: "on", dealName: "Сделка", stageId: "stage_brief", amount: "800000" })),
        (error: unknown) => !(error instanceof DomainError) && /test failure/.test(String(error)),
      );
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_opportunity_insert ON "Opportunity"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS test_fail_opportunity_insert()`);
    }
    assert.equal(await snapshot(), snap);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: L4 } });
    assert.equal(lead.status, "qualified");
    assert.equal(lead.convertedAt, null);
    assert.equal(await prisma.activity.count({ where: { leadId: L4 } }), activities.length);
  });

  test("два одновременных вызова: ровно один успех, одна понятная ошибка, один набор записей", async () => {
    await addLeadActivities(L1);
    const before = { accounts: await prisma.account.count(), contacts: await prisma.contact.count(), deals: await prisma.opportunity.count() };
    const data = input({ ...newCompanyNoDeal, createDeal: "on", dealName: "Стенд", stageId: "stage_brief", amount: "1500000" });

    const results = await Promise.allSettled([convertLead(L1, data), convertLead(L1, data)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    rejectsWith(ALREADY_CONVERTED_MESSAGE)((rejected[0] as PromiseRejectedResult).reason);

    assert.equal(await prisma.account.count(), before.accounts + 1);
    assert.equal(await prisma.contact.count(), before.contacts + 1);
    assert.equal(await prisma.opportunity.count(), before.deals + 1);
    const winner = (fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof convertLead>>>).value;
    assert.equal(winner.movedActivities, 3);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: L1 } });
    assert.deepEqual(
      [lead.convertedAccountId, lead.convertedContactId, lead.convertedOpportunityId],
      [winner.accountId, winner.contactId, winner.opportunityId],
    );
    assert.equal(await prisma.activity.count({ where: { opportunityId: winner.opportunityId } }), 3);
  });

  test("параллельные вызовы в разных режимах (новая и существующая компания): один успех", async () => {
    const results = await Promise.allSettled([
      convertLead(L4, input({ fullName: "Татьяна Новикова", email: "t@example.com", companyMode: "new", companyName: "Северная галерея" })),
      convertLead(L4, input({ fullName: "Татьяна Новикова", email: "t@example.com", companyMode: "existing", accountId: NORD })),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await prisma.contact.count({ where: { fullName: "Татьяна Новикова" } }), 1);
  });
});
