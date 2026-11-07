// Компании и контакты: валидация Zod и правила удаления (Plan.md 1.8, шаг 06). Только studio_crm_agent.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { getAppTimeZone, todayInTimeZone } from "../src/lib/dates";
import { prisma } from "../src/server/db";
import { errorToFormState, DomainError } from "../src/server/errors";
import { createAccount, deleteAccount, getAccountDeleteImpact, updateAccount } from "../src/server/services/accounts";
import { createContact, deleteContact, updateContact } from "../src/server/services/contacts";
import { accountSchema } from "../src/server/validation/account";
import { parseForm } from "../src/server/validation/common";
import { contactSchema } from "../src/server/validation/contact";
import { AGENT_DATABASE_NAME, databaseNameFromUrl } from "../scripts/lib/db-guards";
import { resetDatabase } from "../prisma/seed/run";

const today = todayInTimeZone(getAppTimeZone());
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
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

describe("валидация Zod", () => {
  test("компания: пустое и пробельное название отклоняется", () => {
    for (const name of ["", "   "]) {
      const result = parseForm(accountSchema, form({ name }));
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.fieldErrors.name, "Укажите название компании");
    }
  });

  test("компания: неверный email и телефон отклоняются, пустые необязательные поля — нет", () => {
    const bad = parseForm(accountSchema, form({ name: "Тест", email: "не-почта", phone: "abc" }));
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.match(bad.fieldErrors.email, /Проверьте email/);
      assert.match(bad.fieldErrors.phone, /Телефон/);
    }
    const good = parseForm(accountSchema, form({ name: "  Тест  ", email: "", phone: "", city: " " }));
    assert.equal(good.ok, true);
    if (good.ok) {
      assert.equal(good.data.name, "Тест");
      assert.deepEqual(
        Object.values(good.data).filter((v) => v !== undefined),
        ["Тест"],
      );
    }
  });

  test("контакт: пустое имя отклоняется, пустая компания означает «без компании»", () => {
    const bad = parseForm(contactSchema, form({ fullName: " " }));
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.fieldErrors.fullName, "Укажите имя контакта");
    const good = parseForm(contactSchema, form({ fullName: "Ирина", accountId: "" }));
    assert.equal(good.ok, true);
    if (good.ok) assert.equal(good.data.accountId, undefined);
  });
});

describe("компании", () => {
  test("создание и изменение; пустые поля сохраняются как null", async () => {
    const { id } = await createAccount({ name: "Тестовая галерея", city: "Москва" });
    await updateAccount(id, { name: "Тестовая галерея 2" });
    const account = await prisma.account.findUniqueOrThrow({ where: { id } });
    assert.equal(account.name, "Тестовая галерея 2");
    assert.equal(account.city, null);
  });

  test("изменение несуществующей компании даёт понятное сообщение", async () => {
    const error = await updateAccount("missing", { name: "X" }).catch((e: unknown) => e);
    assert.equal(errorToFormState(error).message, "Запись не найдена — возможно, её уже удалили.");
  });

  test("удаление компании с контактами и сделками заблокировано, данные не меняются", async () => {
    await assert.rejects(
      deleteAccount("seed_acc_nord"),
      (e: unknown) => e instanceof DomainError && e.message === "Нельзя удалить компанию: сначала удалите или перепривяжите 1 контакт и 2 сделки.",
    );
    assert.equal(await prisma.account.count({ where: { id: "seed_acc_nord" } }), 1);
  });

  test("удаление компании только со сделками тоже заблокировано", async () => {
    const { id } = await createAccount({ name: "Только сделка" });
    await prisma.opportunity.create({ data: { name: "Сделка", accountId: id, stageId: "stage_brief" } });
    await assert.rejects(deleteAccount(id), /перепривяжите 1 сделку\./);
  });

  test("удаление свободной компании удаляет и её активности", async () => {
    const { id } = await createAccount({ name: "Удаляемая" });
    await prisma.activity.create({ data: { type: "note", body: "Заметка", accountId: id } });
    const impact = await getAccountDeleteImpact(id);
    assert.deepEqual(impact, {
      contacts: 0,
      opportunities: 0,
      activities: 1,
      blockedReason: null,
      consequences: "Вместе с компанией будет удалена 1 активность. Действие нельзя отменить.",
    });
    await deleteAccount(id);
    assert.equal(await prisma.account.count({ where: { id } }), 0);
    assert.equal(await prisma.activity.count({ where: { accountId: id } }), 0);
  });
});

describe("контакты", () => {
  test("контакт создаётся без компании", async () => {
    const { id } = await createContact({ fullName: "Ирина Смирнова" });
    assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id } })).accountId, null);
  });

  test("несуществующая компания отклоняется с ошибкой поля", async () => {
    await assert.rejects(
      createContact({ fullName: "Ирина", accountId: "missing" }),
      (e: unknown) => e instanceof DomainError && e.fieldErrors?.accountId === "Выбранная компания не найдена — возможно, её удалили.",
    );
  });

  test("удаление контакта со сделкой заблокировано", async () => {
    await assert.rejects(deleteContact("seed_contact_anna"), /привязан к 1 сделке\. Сначала отвяжите его в сделках\./);
    await assert.rejects(deleteContact("seed_contact_dmitry"), /привязан к 2 сделкам/);
  });

  test("удаление контакта без сделок удаляет его активности", async () => {
    const { id } = await createContact({ fullName: "Временный контакт", accountId: "seed_acc_bio" });
    await prisma.activity.create({ data: { type: "note", body: "Заметка", contactId: id } });
    await deleteContact(id);
    assert.equal(await prisma.contact.count({ where: { id } }), 0);
    assert.equal(await prisma.activity.count({ where: { contactId: id } }), 0);
  });

  test("удаление контакта без компании и сделок проходит", async () => {
    await deleteContact("seed_contact_igor");
    assert.equal(await prisma.contact.count({ where: { id: "seed_contact_igor" } }), 0);
  });

  test("смена и очистка компании контакта не меняют его сделки", async () => {
    await updateContact("seed_contact_dmitry", { fullName: "Дмитрий Орлов", accountId: undefined });
    assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: "seed_contact_dmitry" } })).accountId, null);
    const deals = await prisma.opportunity.findMany({ where: { contactId: "seed_contact_dmitry" }, orderBy: { id: "asc" } });
    assert.deepEqual(deals.map((d) => [d.id, d.accountId]), [["seed_deal_d4", "seed_acc_vector"], ["seed_deal_d6", "seed_acc_vector"]]);

    await updateContact("seed_contact_dmitry", { fullName: "Дмитрий Орлов", accountId: "seed_acc_bio" });
    const after = await prisma.opportunity.findMany({ where: { contactId: "seed_contact_dmitry" } });
    assert.ok(after.every((d) => d.accountId === "seed_acc_vector"));
  });

  test("контакт в компании виден в её контактах, после переноса — в новой", async () => {
    const { id } = await createContact({ fullName: "Новый контакт", accountId: "seed_acc_coffee" });
    assert.equal(await prisma.contact.count({ where: { accountId: "seed_acc_coffee" } }), 2);
    await updateContact(id, { fullName: "Новый контакт", accountId: "seed_acc_nord" });
    assert.equal(await prisma.contact.count({ where: { accountId: "seed_acc_coffee" } }), 1);
    assert.equal(await prisma.contact.count({ where: { accountId: "seed_acc_nord" } }), 2);
  });
});
