// Глобальный поиск и связанные записи карточек (Plan.md, шаг 09). Только studio_crm_agent.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { getAppTimeZone, todayInTimeZone } from "../src/lib/dates";
import { prisma } from "../src/server/db";
import { getDeal, listRelatedDeals } from "../src/server/queries/deals";
import { SEARCH_LIMIT, searchCrm } from "../src/server/queries/search";
import { createContact } from "../src/server/services/contacts";
import { createDeal, deleteDeal } from "../src/server/services/deals";
import { updateLead } from "../src/server/services/leads";
import { AGENT_DATABASE_NAME, databaseNameFromUrl } from "../scripts/lib/db-guards";
import { resetDatabase } from "../prisma/seed/run";

const today = todayInTimeZone(getAppTimeZone());

/** Названия найденных записей по группам — для компактных сравнений. */
async function found(q: string) {
  const r = await searchCrm(q);
  return {
    leads: r.leads.items.map((x) => x.contactName).sort(),
    accounts: r.accounts.items.map((x) => x.name).sort(),
    contacts: r.contacts.items.map((x) => x.fullName).sort(),
    deals: r.deals.items.map((x) => x.name).sort(),
  };
}

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

describe("глобальный поиск", () => {
  test("находит все четыре типа записей; регистр не важен", async () => {
    // «Кофе Лаб»: компания, контакт Елена (компания контакта не ищется — только имя, email, телефон), лид L6 и сделка D5.
    const lower = await found("кофе лаб");
    assert.deepEqual(lower, {
      leads: ["Елена Гусева"],
      accounts: ["Кофе Лаб"],
      contacts: [],
      deals: ["Поп-ап пространство"],
    });
    assert.deepEqual(await found("КОФЕ ЛАБ"), lower);
    assert.deepEqual((await found("анна")).contacts, ["Анна Соколова"]);
    assert.deepEqual((await found("ВыСтАвК")).deals, ["Стенд 72 м² на отраслевой выставке", "Стенд для фармацевтической выставки"]);
  });

  test("поиск по email и телефону лида, компании и контакта", async () => {
    assert.deepEqual((await found("arctic-tech")).leads, ["Павел Смирнов"]);
    assert.deepEqual((await found("000-30-03")).leads, ["Сергей Волков"]);
    assert.deepEqual((await found("INFO@NORD-METAL")).accounts, ["Норд Металл"]);
    assert.deepEqual((await found("000-20-01")).contacts, ["Анна Соколова"]);
  });

  test("нет совпадений — все группы пусты", async () => {
    assert.deepEqual(await found("несуществующая запись xyz"), { leads: [], accounts: [], contacts: [], deals: [] });
  });

  test("в каждой группе не больше лимита, признак «есть ещё»", async () => {
    for (let i = 0; i < SEARCH_LIMIT + 2; i++) await createContact({ fullName: `Поисковый тест ${i}` });
    const r = await searchCrm("поисковый тест");
    assert.equal(r.contacts.items.length, SEARCH_LIMIT);
    assert.equal(r.contacts.hasMore, true);
    assert.equal((await searchCrm("анна")).contacts.hasMore, false);
  });

  test("новая и изменённая запись находятся сразу, удалённая — нет", async () => {
    const { id } = await createDeal({ name: "Экспозиция галереи", accountId: "seed_acc_nord", stageId: "stage_brief" });
    assert.deepEqual((await found("экспозиция")).deals, ["Экспозиция галереи"]);
    await updateLead("seed_lead_l1", { contactName: "Павел Новый", phone: "+7 900 000-30-01", source: "site" });
    assert.deepEqual((await found("павел")).leads, ["Павел Новый"]);
    await deleteDeal(id);
    assert.deepEqual((await found("экспозиция")).deals, []);
  });
});

describe("связанные записи карточек", () => {
  test("сделки компании и контакта; сумма — строка", async () => {
    const nord = await listRelatedDeals({ accountId: "seed_acc_nord" });
    assert.deepEqual(nord.map((d) => d.name).sort(), ["Бренд-зона на форуме", "Стенд 72 м² на отраслевой выставке"]);
    assert.ok(nord.every((d) => d.amount === null || typeof d.amount === "string"));
    assert.deepEqual((await listRelatedDeals({ contactId: "seed_contact_dmitry" })).map((d) => d.name).sort(), [
      "Зона тест-драйва",
      "Шоурум новой линейки",
    ]);
    assert.deepEqual(await listRelatedDeals({ contactId: "seed_contact_igor" }), []);
  });

  test("сделка с контактом другой компании видна у контакта вместе с компанией сделки", async () => {
    await createDeal({ name: "Чужая сделка", accountId: "seed_acc_vector", contactId: "seed_contact_anna", stageId: "stage_brief" });
    const annaDeals = await listRelatedDeals({ contactId: "seed_contact_anna" });
    assert.equal(annaDeals.find((d) => d.name === "Чужая сделка")?.account.name, "Вектор Моторс");
    assert.ok((await listRelatedDeals({ accountId: "seed_acc_vector" })).some((d) => d.name === "Чужая сделка"));
  });

  test("сделка D5 знает лид, из которого создана; у D1 такого лида нет", async () => {
    assert.deepEqual((await getDeal("seed_deal_d5"))?.convertedLeads.map((l) => l.contactName), ["Елена Гусева"]);
    assert.deepEqual((await getDeal("seed_deal_d1"))?.convertedLeads, []);
  });
});
