// Лиды: валидация Zod, CRUD, статусы, фильтры и удаление (Plan.md 1.3, 1.8, шаг 07). Только studio_crm_agent.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { getAppTimeZone, todayInTimeZone } from "../src/lib/dates";
import { deleteConsequences } from "../src/lib/format";
import { prisma } from "../src/server/db";
import { DomainError, errorToFormState } from "../src/server/errors";
import { listLeads } from "../src/server/queries/leads";
import {
  CONVERTED_LEAD_READONLY_MESSAGE,
  createLead,
  deleteLead,
  getLeadDeleteImpact,
  updateLead,
} from "../src/server/services/leads";
import { parseForm } from "../src/server/validation/common";
import { leadSchema, parseLeadFilters, type LeadInput } from "../src/server/validation/lead";
import { AGENT_DATABASE_NAME, databaseNameFromUrl } from "../scripts/lib/db-guards";
import { resetDatabase } from "../prisma/seed/run";

const today = todayInTimeZone(getAppTimeZone());
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const names = (leads: { contactName: string }[]) => leads.map((lead) => lead.contactName).sort();
const base: LeadInput = { contactName: "Ольга Морозова", companyName: "Тестовая галерея", phone: "+7 900 111-22-33", source: "manual" };

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

describe("лиды: валидация Zod", () => {
  test("обязателен email или телефон — ошибка у обоих полей и вместе с другими ошибками", () => {
    const result = parseForm(leadSchema, form({ contactName: " ", source: "" }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.fieldErrors, {
        contactName: "Укажите имя контакта",
        source: "Выберите источник",
        email: "Укажите телефон или email",
        phone: "Укажите телефон или email",
      });
    }
    for (const contact of [{ email: "a@example.com" }, { phone: "+7 900 000-00-00" }] as Record<string, string>[]) {
      assert.equal(parseForm(leadSchema, form({ contactName: "Имя", source: "site", ...contact })).ok, true);
    }
  });

  test("неверный email показывает ошибку формата, а не «укажите телефон или email»", () => {
    const result = parseForm(leadSchema, form({ contactName: "Имя", source: "site", email: "не-почта" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(result.fieldErrors, { email: "Проверьте email: например, name@company.ru" });
  });

  test("источник только из enum; статус «converted» и неизвестный статус отклоняются", () => {
    const bad = parseForm(leadSchema, form({ contactName: "Имя", phone: "+7 900 000-00-00", source: "fax", status: "converted" }));
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.equal(bad.fieldErrors.source, "Выберите источник из списка");
      assert.equal(bad.fieldErrors.status, "Статус «Конвертирован» ставится только при конвертации лида");
    }
    const unknown = parseForm(leadSchema, form({ contactName: "Имя", phone: "+7 900 000-00-00", source: "site", status: "archived" }));
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.equal(unknown.fieldErrors.status, "Выберите статус из списка");
  });

  test("бюджет: пробелы и запятая допустимы, отрицательный и лишние знаки — нет; дата проверяется", () => {
    const good = parseForm(leadSchema, form({ contactName: "Имя", phone: "+7 900 000-00-00", source: "site", budget: "1 500 000,5", eventDate: "2026-12-31" }));
    assert.equal(good.ok, true);
    if (good.ok) {
      assert.equal(good.data.budget, "1500000.5");
      assert.equal(good.data.eventDate?.toISOString(), "2026-12-31T00:00:00.000Z");
      assert.equal(good.data.status, undefined);
    }
    for (const budget of ["-5", "12,345", "много", "1234567890123"]) {
      const result = parseForm(leadSchema, form({ contactName: "Имя", phone: "+7 900 000-00-00", source: "site", budget }));
      assert.equal(result.ok, false, budget);
      if (!result.ok) assert.match(result.fieldErrors.budget, /Бюджет/);
    }
    const badDate = parseForm(leadSchema, form({ contactName: "Имя", phone: "+7 900 000-00-00", source: "site", eventDate: "2026-02-30" }));
    assert.equal(badDate.ok, false);
    if (!badDate.ok) assert.equal(badDate.fieldErrors.eventDate, "Такой даты нет — проверьте день и месяц");
  });

  test("фильтры из URL: неизвестные значения игнорируются, пустой поиск не применяется", () => {
    assert.deepEqual(parseLeadFilters({ q: "  ", status: "bogus", source: "site" }), { q: undefined, status: undefined, source: "site" });
    const filters = parseLeadFilters({ q: " Анна ", status: "converted" });
    assert.deepEqual([filters.q, filters.status, filters.source], ["Анна", "converted", undefined]);
  });
});

describe("лиды: создание и изменение", () => {
  test("новый лид получает статус «new», пустые поля — null, бюджет и дата сохраняются точно", async () => {
    const { id } = await createLead({ ...base, budget: "500000.55", eventDate: new Date("2026-12-31T00:00:00.000Z") });
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });
    assert.equal(lead.status, "new");
    assert.equal(lead.email, null);
    assert.equal(lead.budget?.toString(), "500000.55");
    assert.equal(lead.eventDate?.toISOString().slice(0, 10), "2026-12-31");
  });

  test("переходы между ручными статусами разрешены, включая возврат отклонённого в работу", async () => {
    const { id } = await createLead(base);
    for (const status of ["in_progress", "qualified", "disqualified", "in_progress", "new"] as const) {
      await updateLead(id, { ...base, status });
      assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id } })).status, status);
    }
    // Без статуса во входных данных статус не меняется.
    await updateLead(id, { ...base, status: "qualified" });
    await updateLead(id, { ...base, comment: "Без статуса" });
    assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id } })).status, "qualified");
  });

  test("сервис отклоняет статус «converted» при создании и изменении, даже в обход Zod", async () => {
    const converted = { ...base, status: "converted" } as unknown as LeadInput;
    const before = await prisma.lead.count();
    await assert.rejects(createLead(converted), (e: unknown) => e instanceof DomainError && /Конвертирован/.test(e.fieldErrors?.status ?? ""));
    assert.equal(await prisma.lead.count(), before);
    await assert.rejects(updateLead("seed_lead_l1", converted), DomainError);
    assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: "seed_lead_l1" } })).status, "new");
  });

  test("конвертированный лид нельзя изменить и вернуть в другой статус — данные не меняются", async () => {
    const beforeLead = await prisma.lead.findUniqueOrThrow({ where: { id: "seed_lead_l6" } });
    await assert.rejects(
      updateLead("seed_lead_l6", { ...base, status: "new" }),
      (e: unknown) => e instanceof DomainError && e.message === CONVERTED_LEAD_READONLY_MESSAGE,
    );
    const afterLead = await prisma.lead.findUniqueOrThrow({ where: { id: "seed_lead_l6" } });
    assert.deepEqual(afterLead, beforeLead);
  });

  test("изменение несуществующего лида даёт понятное сообщение", async () => {
    const error = await updateLead("missing", base).catch((e: unknown) => e);
    assert.equal(errorToFormState(error).message, "Запись не найдена — возможно, её уже удалили.");
  });
});

describe("лиды: фильтры и поиск в базе", () => {
  test("статус, источник и поиск сочетаются; поиск без учёта регистра по имени, компании, email и телефону", async () => {
    assert.equal((await listLeads({})).length, 6);
    assert.deepEqual(names(await listLeads({ source: "site" })), ["Елена Гусева", "Павел Смирнов"]);
    assert.deepEqual(names(await listLeads({ source: "site", status: "new" })), ["Павел Смирнов"]);
    assert.deepEqual(names(await listLeads({ status: "converted" })), ["Елена Гусева"]);
    assert.deepEqual(names(await listLeads({ q: "павел" })), ["Павел Смирнов"]);
    assert.deepEqual(names(await listLeads({ q: "кофе" })), ["Елена Гусева"]);
    assert.deepEqual(names(await listLeads({ q: "OLGA.LEBEDEVA" })), ["Ольга Лебедева"]);
    assert.deepEqual(names(await listLeads({ q: "30-05" })), ["Андрей Козлов"]);
    assert.deepEqual(await listLeads({ q: "кофе", status: "new" }), []);
  });

  test("новый лид сразу попадает в отфильтрованный список, а после изменения — уходит из него", async () => {
    const { id } = await createLead(base);
    assert.deepEqual(names(await listLeads({ source: "manual", status: "new" })), ["Ольга Морозова"]);
    await updateLead(id, { ...base, status: "qualified" });
    assert.deepEqual(await listLeads({ source: "manual", status: "new" }), []);
    assert.deepEqual(names(await listLeads({ status: "qualified", q: "галерея" })), ["Ольга Морозова", "Татьяна Новикова"]);
  });

  test("бюджет в списке — строка, а не объект Decimal", async () => {
    const [l4] = await listLeads({ q: "Новикова" });
    assert.equal(l4.budget, "800000");
  });
});

describe("лиды: удаление", () => {
  test("согласование числа активностей в тексте подтверждения", () => {
    assert.equal(deleteConsequences("с лидом", 0), "Действие нельзя отменить.");
    assert.equal(deleteConsequences("с лидом", 1), "Вместе с лидом будет удалена 1 активность. Действие нельзя отменить.");
    assert.equal(deleteConsequences("с лидом", 2), "Вместе с лидом будут удалены 2 активности. Действие нельзя отменить.");
    assert.equal(deleteConsequences("с лидом", 5), "Вместе с лидом будут удалены 5 активностей. Действие нельзя отменить.");
    assert.equal(deleteConsequences("с лидом", 21), "Вместе с лидом будет удалена 21 активность. Действие нельзя отменить.");
  });

  test("удаление лида удаляет его активности", async () => {
    const impact = await getLeadDeleteImpact("seed_lead_l3");
    assert.deepEqual(impact, {
      activities: 1,
      blockedReason: null,
      consequences: "Вместе с лидом будет удалена 1 активность. Действие нельзя отменить.",
    });
    await deleteLead("seed_lead_l3");
    assert.equal(await prisma.lead.count({ where: { id: "seed_lead_l3" } }), 0);
    assert.equal(await prisma.activity.count({ where: { leadId: "seed_lead_l3" } }), 0);
    assert.equal(await prisma.activity.count(), 7);
  });

  test("удаление конвертированного лида не затрагивает компанию, контакт и сделку", async () => {
    const impact = await getLeadDeleteImpact("seed_lead_l6");
    assert.match(impact.consequences, /^Компания, контакт и сделка, созданные при конвертации, останутся\./);
    await deleteLead("seed_lead_l6");
    assert.equal(await prisma.account.count({ where: { id: "seed_acc_coffee" } }), 1);
    assert.equal(await prisma.contact.count({ where: { id: "seed_contact_elena" } }), 1);
    assert.equal(await prisma.opportunity.count({ where: { id: "seed_deal_d5" } }), 1);
  });

  test("повторное удаление даёт понятное сообщение", async () => {
    await deleteLead("seed_lead_l1");
    const error = await deleteLead("seed_lead_l1").catch((e: unknown) => e);
    assert.equal(errorToFormState(error).message, "Запись не найдена — возможно, её уже удалили.");
  });
});
