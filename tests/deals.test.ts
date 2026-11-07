// Сделки: валидация Zod, CRUD, инварианты закрытых стадий, фильтры и удаление (Plan.md 1.4, 1.5, 1.8, шаг 08).
// Только studio_crm_agent.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { getAppTimeZone, todayInTimeZone } from "../src/lib/dates";
import { formatMoney } from "../src/lib/format";
import { prisma } from "../src/server/db";
import { DomainError } from "../src/server/errors";
import { listDeals } from "../src/server/queries/deals";
import { getContactDeleteImpact } from "../src/server/services/contacts";
import {
  createDeal,
  deleteDeal,
  getDealDeleteImpact,
  LOST_REASON_MESSAGE,
  OPEN_STAGE_ONLY_MESSAGE,
  stageRuleErrors,
  updateDeal,
  WON_AMOUNT_MESSAGE,
  WON_CONTACT_MESSAGE,
} from "../src/server/services/deals";
import { parseForm } from "../src/server/validation/common";
import {
  dealCreateSchema,
  dealUpdateSchema,
  parseDealFilters,
  type DealCreateInput,
  type DealUpdateInput,
} from "../src/server/validation/deal";
import { AGENT_DATABASE_NAME, databaseNameFromUrl } from "../scripts/lib/db-guards";
import { resetDatabase } from "../prisma/seed/run";

const today = todayInTimeZone(getAppTimeZone());
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const names = (deals: { name: string }[]) => deals.map((deal) => deal.name).sort();
const fieldErrors = (expected: Record<string, string>) => (error: unknown) => {
  assert.ok(error instanceof DomainError);
  assert.deepEqual(error.fieldErrors, expected);
  return true;
};

const ID = {
  nord: "seed_acc_nord",
  vector: "seed_acc_vector",
  anna: "seed_contact_anna",
  igor: "seed_contact_igor",
  elena: "seed_contact_elena",
  dmitry: "seed_contact_dmitry",
  d2: "seed_deal_d2",
  d5: "seed_deal_d5",
  d6: "seed_deal_d6",
};

const newDeal: DealCreateInput = { name: "Экспозиция галереи", accountId: ID.nord, stageId: "stage_brief" };

/** Текущие данные сделки в виде входа формы изменения — чтобы менять по одному полю. */
async function editInput(id: string): Promise<DealUpdateInput> {
  const deal = await prisma.opportunity.findUniqueOrThrow({ where: { id } });
  return {
    name: deal.name,
    accountId: deal.accountId,
    contactId: deal.contactId ?? undefined,
    amount: deal.amount?.toString(),
    lostReason: deal.lostReason ?? undefined,
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

describe("сделки: валидация Zod", () => {
  test("название, компания и стадия обязательны при создании", () => {
    const result = parseForm(dealCreateSchema, form({ name: "  ", accountId: "", stageId: "" }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.fieldErrors, {
        name: "Укажите название сделки",
        accountId: "Выберите компанию",
        stageId: "Выберите стадию",
      });
    }
  });

  test("сумма: пробелы и запятая допустимы, копейки сохраняются строкой; отрицательная и три знака — нет", () => {
    const good = parseForm(dealCreateSchema, form({ name: "С", accountId: ID.nord, stageId: "stage_brief", amount: "1 234 567,89" }));
    assert.equal(good.ok, true);
    if (good.ok) assert.equal(good.data.amount, "1234567.89");
    for (const amount of ["-5", "10.555", "1e6", "сто"]) {
      const bad = parseForm(dealCreateSchema, form({ name: "С", accountId: ID.nord, stageId: "stage_brief", amount }));
      assert.equal(bad.ok, false, amount);
      if (!bad.ok) assert.match(bad.fieldErrors.amount, /^Сумма:/);
    }
  });

  test("в форме изменения стадии нет: присланный stageId отбрасывается", () => {
    const result = parseForm(dealUpdateSchema, form({ name: "С", accountId: ID.nord, stageId: "stage_won" }));
    assert.equal(result.ok, true);
    if (result.ok) assert.equal("stageId" in result.data, false);
  });

  test("фильтры из URL: неизвестный статус и неверная стадия игнорируются", () => {
    assert.deepEqual(parseDealFilters({ q: "  ", status: "archived", stage: "DROP TABLE" }), {
      q: undefined,
      status: undefined,
      stage: undefined,
    });
    assert.deepEqual(parseDealFilters({ q: "норд", status: "won", stage: "stage_brief" }), {
      q: "норд",
      status: "won",
      stage: "stage_brief",
    });
  });
});

describe("сделки: правила стадий (Plan.md 1.5)", () => {
  test("won требует сумму больше нуля и контакт; lost — непустую причину; open — ничего", () => {
    assert.deepEqual(stageRuleErrors("won", {}), { amount: WON_AMOUNT_MESSAGE, contactId: WON_CONTACT_MESSAGE });
    assert.deepEqual(stageRuleErrors("won", { amount: "0.00", contactId: ID.anna }), { amount: WON_AMOUNT_MESSAGE });
    assert.deepEqual(stageRuleErrors("won", { amount: "0.01", contactId: ID.anna }), {});
    assert.deepEqual(stageRuleErrors("lost", { lostReason: "   " }), { lostReason: LOST_REASON_MESSAGE });
    assert.deepEqual(stageRuleErrors("lost", { lostReason: "Выбрали другое агентство" }), {});
    assert.deepEqual(stageRuleErrors("open", {}), {});
  });

  test("новая сделка в стадии won или lost отклоняется сервером в обход формы, ничего не создаётся", async () => {
    const before = await prisma.opportunity.count();
    for (const stageId of ["stage_won", "stage_lost"]) {
      await assert.rejects(
        createDeal({ ...newDeal, stageId, amount: "100", contactId: ID.anna }),
        fieldErrors({ stageId: OPEN_STAGE_ONLY_MESSAGE }),
      );
    }
    await assert.rejects(createDeal({ ...newDeal, stageId: "stage_missing" }), DomainError);
    assert.equal(await prisma.opportunity.count(), before);
  });

  test("у выигранной D5 нельзя очистить сумму, обнулить её или убрать контакт — данные не меняются", async () => {
    const original = await prisma.opportunity.findUniqueOrThrow({ where: { id: ID.d5 } });
    const input = await editInput(ID.d5);
    await assert.rejects(updateDeal(ID.d5, { ...input, amount: undefined }), fieldErrors({ amount: WON_AMOUNT_MESSAGE }));
    await assert.rejects(updateDeal(ID.d5, { ...input, amount: "0" }), fieldErrors({ amount: WON_AMOUNT_MESSAGE }));
    await assert.rejects(updateDeal(ID.d5, { ...input, contactId: undefined }), fieldErrors({ contactId: WON_CONTACT_MESSAGE }));
    await assert.rejects(
      updateDeal(ID.d5, { ...input, amount: undefined, contactId: undefined }),
      (error: unknown) => error instanceof DomainError && /Сделка выиграна/.test(error.message),
    );
    assert.deepEqual(await prisma.opportunity.findUniqueOrThrow({ where: { id: ID.d5 } }), original);
  });

  test("выигранную D5 можно изменить, сохранив сумму и контакт; стадия и дата закрытия не меняются", async () => {
    const original = await prisma.opportunity.findUniqueOrThrow({ where: { id: ID.d5 } });
    await updateDeal(ID.d5, { ...(await editInput(ID.d5)), amount: "700000.50", lostReason: "лишнее" });
    const deal = await prisma.opportunity.findUniqueOrThrow({ where: { id: ID.d5 } });
    assert.equal(deal.amount?.toString(), "700000.5");
    assert.equal(deal.stageId, original.stageId);
    assert.deepEqual(deal.closedAt, original.closedAt);
    assert.equal(deal.lostReason, null);
  });

  test("у проигранной D6 нельзя очистить причину; новую причину сохранить можно", async () => {
    const input = await editInput(ID.d6);
    for (const lostReason of [undefined, "   "]) {
      await assert.rejects(
        updateDeal(ID.d6, { ...input, lostReason: lostReason?.trim() || undefined }),
        fieldErrors({ lostReason: LOST_REASON_MESSAGE }),
      );
    }
    assert.ok((await prisma.opportunity.findUniqueOrThrow({ where: { id: ID.d6 } })).lostReason);
    await updateDeal(ID.d6, { ...input, lostReason: "Перенесли выставку на следующий год" });
    assert.equal(
      (await prisma.opportunity.findUniqueOrThrow({ where: { id: ID.d6 } })).lostReason,
      "Перенесли выставку на следующий год",
    );
  });

  test("у открытой сделки причина проигрыша не сохраняется, даже если её прислать", async () => {
    await updateDeal(ID.d2, { ...(await editInput(ID.d2)), lostReason: "Подмена в обход формы" });
    assert.equal((await prisma.opportunity.findUniqueOrThrow({ where: { id: ID.d2 } })).lostReason, null);
  });
});

describe("сделки: CRUD и связи", () => {
  test("открытая сделка создаётся без суммы и контакта; пустые поля — null", async () => {
    const { id } = await createDeal(newDeal);
    const deal = await prisma.opportunity.findUniqueOrThrow({ where: { id }, include: { stage: true } });
    assert.equal(deal.stage.type, "open");
    assert.equal(deal.amount, null);
    assert.equal(deal.contactId, null);
    assert.equal(deal.lostReason, null);
    assert.equal(deal.closedAt, null);
  });

  test("сумма хранится без потери копеек, включая максимум Decimal(14, 2); в списке — строка", async () => {
    for (const amount of ["1234567.89", "999999999999.99", "0.01"]) {
      const { id } = await createDeal({ ...newDeal, amount });
      const stored = await prisma.opportunity.findUniqueOrThrow({ where: { id } });
      assert.equal(stored.amount?.toFixed(2), amount);
      const listed = (await listDeals({})).find((deal) => deal.id === id);
      assert.equal(listed?.amount, stored.amount?.toString());
      assert.equal(typeof listed?.amount, "string");
    }
    // Intl разделяет разряды неразрывными пробелами — сравниваем без учёта вида пробела.
    assert.equal(formatMoney("999999999999.99").replace(/\s/g, " "), "999 999 999 999,99 ₽");
  });

  test("контакт другой компании и контакт без компании привязываются; компании не сверяются", async () => {
    const other = await createDeal({ ...newDeal, accountId: ID.vector, contactId: ID.anna });
    const noCompany = await createDeal({ ...newDeal, contactId: ID.igor });
    const linked = await prisma.opportunity.findMany({
      where: { id: { in: [other.id, noCompany.id] } },
      include: { contact: { select: { accountId: true } } },
    });
    const byId = new Map(linked.map((deal) => [deal.id, deal]));
    assert.equal(byId.get(other.id)?.accountId, ID.vector);
    assert.equal(byId.get(other.id)?.contact?.accountId, ID.nord);
    assert.equal(byId.get(noCompany.id)?.contact?.accountId, null);
    // Сделка видна в связях обоих: у контакта и у компании сделки.
    assert.equal(await prisma.opportunity.count({ where: { contactId: ID.igor } }), 1);
    assert.equal(await prisma.opportunity.count({ where: { accountId: ID.vector, contactId: ID.anna } }), 1);
  });

  test("несуществующие компания и контакт отклоняются ошибками полей", async () => {
    await assert.rejects(
      createDeal({ ...newDeal, accountId: "missing", contactId: "missing" }),
      fieldErrors({
        accountId: "Выбранная компания не найдена — возможно, её удалили.",
        contactId: "Выбранный контакт не найден — возможно, его удалили.",
      }),
    );
  });

  test("изменение несуществующей сделки — понятное сообщение", async () => {
    await assert.rejects(
      updateDeal("missing", { name: "С", accountId: ID.nord }),
      (error: unknown) => error instanceof DomainError && /не найдена/.test(error.message),
    );
  });

  test("смена компании и контакта открытой сделки сохраняется, стадия не меняется", async () => {
    await updateDeal(ID.d2, { name: "Бренд-зона", accountId: ID.vector, contactId: ID.elena, amount: "10" });
    const deal = await prisma.opportunity.findUniqueOrThrow({ where: { id: ID.d2 } });
    assert.deepEqual(
      { name: deal.name, accountId: deal.accountId, contactId: deal.contactId, stageId: deal.stageId },
      { name: "Бренд-зона", accountId: ID.vector, contactId: ID.elena, stageId: "stage_brief" },
    );
  });
});

describe("сделки: фильтры и поиск в базе", () => {
  test("«Статус: Выиграна» — D5, «Открыта» — четыре, «Стадия: Бриф» — D1 и D2", async () => {
    assert.deepEqual(names(await listDeals({ status: "won" })), ["Поп-ап пространство"]);
    assert.equal((await listDeals({ status: "open" })).length, 4);
    assert.deepEqual(names(await listDeals({ stage: "stage_brief" })), ["Бренд-зона на форуме", "Стенд 72 м² на отраслевой выставке"]);
  });

  test("несовместимые статус и стадия дают пустой список; совместимые сочетаются", async () => {
    assert.deepEqual(await listDeals({ status: "won", stage: "stage_brief" }), []);
    assert.equal((await listDeals({ status: "open", stage: "stage_brief" })).length, 2);
  });

  test("поиск без учёта регистра по названию, компании и контакту, вместе с фильтрами", async () => {
    assert.deepEqual(names(await listDeals({ q: "ШОУРУМ" })), ["Шоурум новой линейки"]);
    assert.deepEqual(names(await listDeals({ q: "норд" })), ["Бренд-зона на форуме", "Стенд 72 м² на отраслевой выставке"]);
    assert.deepEqual(names(await listDeals({ q: "орлов" })), ["Зона тест-драйва", "Шоурум новой линейки"]);
    assert.deepEqual(names(await listDeals({ q: "орлов", status: "lost" })), ["Зона тест-драйва"]);
  });

  test("новая сделка сразу попадает в отфильтрованный список", async () => {
    await createDeal({ ...newDeal, stageId: "stage_contract" });
    assert.deepEqual(names(await listDeals({ stage: "stage_contract", status: "open" })), ["Экспозиция галереи"]);
  });
});

describe("сделки: удаление", () => {
  test("диалог D5 называет активность и конвертированный лид", async () => {
    const impact = await getDealDeleteImpact(ID.d5);
    assert.equal(impact.activities, 1);
    assert.equal(impact.blockedReason, null);
    assert.equal(
      impact.consequences,
      "Компания и контакт сделки останутся. Лид, из которого создана сделка, останется конвертированным. " +
        "Вместе со сделкой будет удалена 1 активность. Действие нельзя отменить.",
    );
  });

  test("удаление D5: активности удалены, компания и контакт остались, лид L6 остался конвертированным без ссылки", async () => {
    await deleteDeal(ID.d5);
    assert.equal(await prisma.opportunity.count({ where: { id: ID.d5 } }), 0);
    assert.equal(await prisma.activity.count({ where: { opportunityId: ID.d5 } }), 0);
    assert.equal(await prisma.account.count({ where: { id: "seed_acc_coffee" } }), 1);
    assert.equal(await prisma.contact.count({ where: { id: ID.elena } }), 1);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: "seed_lead_l6" } });
    assert.equal(lead.status, "converted");
    assert.equal(lead.convertedOpportunityId, null);
  });

  test("удаление всех сделок контакта снимает блокировку удаления контакта (Plan.md 1.8)", async () => {
    assert.notEqual((await getContactDeleteImpact(ID.dmitry)).blockedReason, null);
    await deleteDeal("seed_deal_d4");
    await deleteDeal(ID.d6);
    assert.equal((await getContactDeleteImpact(ID.dmitry)).blockedReason, null);
  });

  test("повторное удаление уже удалённой сделки даёт ошибку «не найдена»", async () => {
    await deleteDeal(ID.d2);
    await assert.rejects(deleteDeal(ID.d2), (error: unknown) => (error as { code?: string }).code === "P2025");
  });
});
