// Смена стадии сделки: единая серверная операция и правила 1.5 (Plan.md, шаг 11). Только studio_crm_agent.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { getAppTimeZone, todayInTimeZone } from "../src/lib/dates";
import { prisma } from "../src/server/db";
import { DomainError } from "../src/server/errors";
import {
  changeDealStage,
  LOST_REASON_MESSAGE,
  SAME_STAGE_MESSAGE,
  STAGE_CHANGED_MESSAGE,
  STAGE_NOT_FOUND_MESSAGE,
  updateDeal,
  WON_AMOUNT_MESSAGE,
  WON_CONTACT_MESSAGE,
} from "../src/server/services/deals";
import { parseForm } from "../src/server/validation/common";
import { dealStageChangeSchema, type DealStageChangeInput } from "../src/server/validation/deal";
import { AGENT_DATABASE_NAME, databaseNameFromUrl } from "../scripts/lib/db-guards";
import { resetDatabase } from "../prisma/seed/run";

const today = todayInTimeZone(getAppTimeZone());

const ID = {
  anna: "seed_contact_anna",
  igor: "seed_contact_igor",
  d1: "seed_deal_d1", // Бриф, сумма и контакт есть
  d2: "seed_deal_d2", // Бриф, без суммы и контакта
  d3: "seed_deal_d3", // Концепция, сумма и контакт есть
  d5: "seed_deal_d5", // Выиграна
  d6: "seed_deal_d6", // Проиграна, причина есть
};

const snapshot = (id: string) =>
  prisma.opportunity.findUniqueOrThrow({
    where: { id },
    select: { stageId: true, amount: true, contactId: true, lostReason: true, closedAt: true, updatedAt: true },
  });

/** Ожидает DomainError с точным сообщением и (если указано) ошибками полей. */
const refused = (message: string, fieldErrors?: Record<string, string>) => (error: unknown) => {
  assert.ok(error instanceof DomainError, String(error));
  assert.equal(error.message, message);
  if (fieldErrors) assert.deepEqual(error.fieldErrors, fieldErrors);
  return true;
};

/** Сделка отклонена и не изменилась ни в одном поле. */
async function assertRefusedUnchanged(id: string, input: DealStageChangeInput, check: (error: unknown) => boolean) {
  const before = await snapshot(id);
  await assert.rejects(changeDealStage(id, input), check);
  assert.deepEqual(await snapshot(id), before);
}

const move = (stageId: string, fromStageId: string, extra: Partial<DealStageChangeInput> = {}): DealStageChangeInput => ({
  stageId,
  fromStageId,
  ...extra,
});

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

describe("смена стадии: Zod", () => {
  test("целевая и текущая стадии обязательны; сумма в формате формы; причина до 500 символов", () => {
    const empty = parseForm(dealStageChangeSchema, new FormData());
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.deepEqual(Object.keys(empty.fieldErrors).sort(), ["fromStageId", "stageId"]);

    const data = new FormData();
    for (const [key, value] of Object.entries({ stageId: "stage_won", fromStageId: "stage_brief", amount: "1 500 000,50", contactId: "", lostReason: "  " })) {
      data.set(key, value);
    }
    const good = parseForm(dealStageChangeSchema, data);
    assert.equal(good.ok, true);
    if (good.ok) {
      assert.deepEqual(good.data, {
        stageId: "stage_won",
        fromStageId: "stage_brief",
        amount: "1500000.50",
        contactId: undefined,
        lostReason: undefined,
      });
    }

    data.set("amount", "-1");
    data.set("lostReason", "я".repeat(501));
    const bad = parseForm(dealStageChangeSchema, data);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.deepEqual(Object.keys(bad.fieldErrors).sort(), ["amount", "lostReason"]);
  });
});

describe("смена стадии: разрешённые переходы (Plan.md 1.5)", () => {
  test("открытая → открытая: меняется только стадия, сумма и контакт не нужны", async () => {
    const before = await snapshot(ID.d2);
    assert.deepEqual(await changeDealStage(ID.d2, move("stage_contract", "stage_brief")), { stageName: "Договор" });
    const after = await snapshot(ID.d2);
    assert.equal(after.stageId, "stage_contract");
    assert.equal(after.amount, null);
    assert.equal(after.contactId, null);
    assert.equal(after.closedAt, null);
    assert.equal(after.lostReason, before.lostReason);
  });

  test("открытая → won: сумма и контакт есть — сделка закрыта, closedAt = сейчас", async () => {
    const start = Date.now();
    await changeDealStage(ID.d1, move("stage_won", "stage_brief"));
    const deal = await snapshot(ID.d1);
    assert.equal(deal.stageId, "stage_won");
    assert.equal(deal.amount?.toString(), "1200000");
    assert.equal(deal.contactId, ID.anna);
    assert.equal(deal.lostReason, null);
    assert.ok(deal.closedAt && deal.closedAt.getTime() >= start - 1000);
  });

  test("открытая → won: недостающие сумма и контакт заполняются в том же запросе", async () => {
    await changeDealStage(ID.d2, move("stage_won", "stage_brief", { amount: "750000.50", contactId: ID.igor }));
    const deal = await snapshot(ID.d2);
    assert.equal(deal.stageId, "stage_won");
    assert.equal(deal.amount?.toString(), "750000.5");
    assert.equal(deal.contactId, ID.igor);
    assert.ok(deal.closedAt);
  });

  test("открытая → lost: причина сохраняется без пробелов по краям, closedAt = сейчас", async () => {
    await changeDealStage(ID.d3, move("stage_lost", "stage_concept", { lostReason: "  Клиент отменил участие  " }));
    const deal = await snapshot(ID.d3);
    assert.equal(deal.stageId, "stage_lost");
    assert.equal(deal.lostReason, "Клиент отменил участие");
    assert.ok(deal.closedAt);
    // Сумма и контакт при проигрыше не трогаются.
    assert.equal(deal.amount?.toString(), "2400000");
  });

  test("lost → открытая: причина и дата закрытия очищаются", async () => {
    await changeDealStage(ID.d6, move("stage_approval", "stage_lost"));
    const deal = await snapshot(ID.d6);
    assert.equal(deal.stageId, "stage_approval");
    assert.equal(deal.lostReason, null);
    assert.equal(deal.closedAt, null);
  });

  test("won → открытая: дата закрытия очищается, сумма и контакт остаются", async () => {
    await changeDealStage(ID.d5, move("stage_contract", "stage_won"));
    const deal = await snapshot(ID.d5);
    assert.equal(deal.stageId, "stage_contract");
    assert.equal(deal.closedAt, null);
    assert.equal(deal.lostReason, null);
    assert.equal(deal.amount?.toString(), "650000");
  });

  test("won → lost: нужна причина; дата закрытия обновляется", async () => {
    const before = await snapshot(ID.d5);
    await changeDealStage(ID.d5, move("stage_lost", "stage_won", { lostReason: "Клиент расторг договор" }));
    const deal = await snapshot(ID.d5);
    assert.equal(deal.stageId, "stage_lost");
    assert.equal(deal.lostReason, "Клиент расторг договор");
    assert.ok(deal.closedAt && before.closedAt && deal.closedAt > before.closedAt);
  });

  test("lost → won: причина очищается, правила won проверяются", async () => {
    await changeDealStage(ID.d6, move("stage_won", "stage_lost"));
    const deal = await snapshot(ID.d6);
    assert.equal(deal.stageId, "stage_won");
    assert.equal(deal.lostReason, null);
    assert.ok(deal.closedAt);
  });

  test("в lost присланные сумма и контакт игнорируются: стадия не меняет эти поля", async () => {
    await changeDealStage(ID.d2, move("stage_lost", "stage_brief", { lostReason: "Нет бюджета", amount: "1", contactId: ID.anna }));
    const deal = await snapshot(ID.d2);
    assert.equal(deal.amount, null);
    assert.equal(deal.contactId, null);
  });
});

describe("смена стадии: отказы, сделка не меняется (таблица шага 11)", () => {
  test("won: контакт есть, суммы нет — причина в сумме", async () => {
    await prisma.opportunity.update({ where: { id: ID.d2 }, data: { contactId: ID.anna } });
    await assertRefusedUnchanged(
      ID.d2,
      move("stage_won", "stage_brief"),
      refused("Нельзя закрыть сделку как выигранную: укажите сумму больше нуля.", { amount: WON_AMOUNT_MESSAGE }),
    );
  });

  test("won: сумма есть, контакта нет — причина в контакте", async () => {
    await prisma.opportunity.update({ where: { id: ID.d2 }, data: { amount: "100000" } });
    await assertRefusedUnchanged(
      ID.d2,
      move("stage_won", "stage_brief"),
      refused("Нельзя закрыть сделку как выигранную: укажите контакт.", { contactId: WON_CONTACT_MESSAGE }),
    );
  });

  test("won: нет ни суммы, ни контакта (D2) — обе причины", async () => {
    await assertRefusedUnchanged(
      ID.d2,
      move("stage_won", "stage_brief"),
      refused("Нельзя закрыть сделку как выигранную: укажите сумму больше нуля и контакт.", {
        amount: WON_AMOUNT_MESSAGE,
        contactId: WON_CONTACT_MESSAGE,
      }),
    );
  });

  test("won: нулевая сумма из диалога отклоняется", async () => {
    await assertRefusedUnchanged(
      ID.d2,
      move("stage_won", "stage_brief", { amount: "0", contactId: ID.anna }),
      refused("Нельзя закрыть сделку как выигранную: укажите сумму больше нуля.", { amount: WON_AMOUNT_MESSAGE }),
    );
  });

  test("won: несуществующий контакт из диалога отклоняется", async () => {
    await assertRefusedUnchanged(
      ID.d2,
      move("stage_won", "stage_brief", { amount: "100", contactId: "missing_contact" }),
      refused("Проверьте выделенные поля.", { contactId: "Выбранный контакт не найден — возможно, его удалили." }),
    );
  });

  test("lost без причины и с причиной из пробелов отклоняется", async () => {
    for (const lostReason of [undefined, "   "]) {
      await assertRefusedUnchanged(
        ID.d1,
        move("stage_lost", "stage_brief", { lostReason }),
        refused("Нельзя закрыть сделку как проигранную: укажите причину проигрыша.", { lostReason: LOST_REASON_MESSAGE }),
      );
    }
  });

  test("won → lost без новой причины отклоняется", async () => {
    await assertRefusedUnchanged(
      ID.d5,
      move("stage_lost", "stage_won"),
      refused("Нельзя закрыть сделку как проигранную: укажите причину проигрыша.", { lostReason: LOST_REASON_MESSAGE }),
    );
  });

  test("несуществующая стадия", async () => {
    await assertRefusedUnchanged(
      ID.d1,
      move("stage_archive", "stage_brief"),
      refused(STAGE_NOT_FOUND_MESSAGE, { stageId: STAGE_NOT_FOUND_MESSAGE }),
    );
  });

  test("несуществующая сделка", async () => {
    await assert.rejects(
      changeDealStage("missing_deal", move("stage_concept", "stage_brief")),
      refused("Запись не найдена — возможно, её уже удалили."),
    );
  });

  test("та же стадия", async () => {
    await assertRefusedUnchanged(ID.d1, move("stage_brief", "stage_brief"), refused(SAME_STAGE_MESSAGE));
  });

  test("устаревшие данные: стадию уже сменили — запрос с прежней стадией отклоняется", async () => {
    await changeDealStage(ID.d1, move("stage_concept", "stage_brief"));
    await assertRefusedUnchanged(ID.d1, move("stage_won", "stage_brief"), refused(STAGE_CHANGED_MESSAGE));
  });
});

describe("смена стадии: параллельные вызовы", () => {
  test("два одновременных переноса одной сделки: ровно один успех, второй — понятная ошибка", async () => {
    const results = await Promise.allSettled([
      changeDealStage(ID.d1, move("stage_won", "stage_brief")),
      changeDealStage(ID.d1, move("stage_lost", "stage_brief", { lostReason: "Отказ" })),
    ]);
    const ok = results.filter((result) => result.status === "fulfilled");
    const failed = results.filter((result) => result.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(failed.length, 1);
    assert.ok(refused(STAGE_CHANGED_MESSAGE)((failed[0] as PromiseRejectedResult).reason));

    // Состояние согласовано с тем переходом, который прошёл.
    const deal = await snapshot(ID.d1);
    assert.ok(deal.closedAt);
    if (deal.stageId === "stage_won") assert.equal(deal.lostReason, null);
    else assert.equal(deal.lostReason, "Отказ");
  });

  test("выигрыш параллельно с очисткой суммы в форме: сделка не закрывается с пустой суммой", async () => {
    // 20 повторов, чтобы порядок операций менялся. Инвариант: в won всегда сумма > 0 и контакт.
    for (let attempt = 0; attempt < 20; attempt++) {
      await resetDatabase(prisma, today);
      await Promise.allSettled([
        changeDealStage(ID.d1, move("stage_won", "stage_brief")),
        updateDeal(ID.d1, { name: "Стенд", accountId: "seed_acc_nord", contactId: ID.anna }),
      ]);
      const deal = await snapshot(ID.d1);
      if (deal.stageId === "stage_won") {
        assert.ok(deal.amount && deal.amount.greaterThan(0), `попытка ${attempt}: won без суммы`);
        assert.ok(deal.contactId);
      } else {
        assert.equal(deal.stageId, "stage_brief");
        assert.equal(deal.closedAt, null);
      }
    }
  });
});
