// Операции seed и reset. Стадии (справочник из миграции) не удаляются и не создаются.
import type { Prisma, PrismaClient } from "@prisma/client";
import { buildSeedData, type SeedData } from "./data";

type Db = PrismaClient | Prisma.TransactionClient;

export const EXPECTED_STAGE_KEYS = ["brief", "concept", "approval", "contract", "won", "lost"];

export interface DataCounts {
  leads: number;
  accounts: number;
  contacts: number;
  opportunities: number;
  activities: number;
}

export async function countData(db: Db): Promise<DataCounts> {
  const [leads, accounts, contacts, opportunities, activities] = await Promise.all([
    db.lead.count(),
    db.account.count(),
    db.contact.count(),
    db.opportunity.count(),
    db.activity.count(),
  ]);
  return { leads, accounts, contacts, opportunities, activities };
}

async function assertStagesPresent(db: Db): Promise<void> {
  const keys = (await db.stage.findMany({ orderBy: { order: "asc" }, select: { key: true } })).map(
    (s) => s.key,
  );
  if (keys.join(",") !== EXPECTED_STAGE_KEYS.join(",")) {
    throw new Error("Стадии воронки не найдены. Сначала примените миграции: npm run db:deploy");
  }
}

/** Удаляет строки всех таблиц, кроме Stage. Схема и база остаются. */
export async function clearDemoData(db: Db): Promise<void> {
  await db.activity.deleteMany();
  await db.lead.deleteMany();
  await db.opportunity.deleteMany();
  await db.contact.deleteMany();
  await db.account.deleteMany();
}

async function insertSeedData(db: Db, data: SeedData): Promise<void> {
  await db.account.createMany({ data: data.accounts });
  await db.contact.createMany({ data: data.contacts });
  await db.opportunity.createMany({ data: data.opportunities });
  await db.lead.createMany({ data: data.leads });
  await db.activity.createMany({ data: data.activities });
}

const TRANSACTION_OPTIONS = { timeout: 20_000 };

/** db:seed — только в пустую базу; иначе ошибка без изменений. */
export async function seedEmptyDatabase(prisma: PrismaClient, today: Date): Promise<DataCounts> {
  return prisma.$transaction(async (tx) => {
    await assertStagesPresent(tx);
    const before = await countData(tx);
    const total = Object.values(before).reduce((sum, n) => sum + n, 0);
    if (total > 0) {
      throw new Error(
        `База не пуста (лидов: ${before.leads}, компаний: ${before.accounts}, контактов: ${before.contacts}, ` +
          `сделок: ${before.opportunities}, активностей: ${before.activities}). Данные не изменены. ` +
          "Чтобы восстановить демонстрационные данные, используйте npm run db:reset.",
      );
    }
    await insertSeedData(tx, buildSeedData(today));
    return countData(tx);
  }, TRANSACTION_OPTIONS);
}

/** db:reset — очистка строк (кроме Stage) и загрузка контрольных данных в одной транзакции. */
export async function resetDatabase(prisma: PrismaClient, today: Date): Promise<DataCounts> {
  return prisma.$transaction(async (tx) => {
    await assertStagesPresent(tx);
    await clearDemoData(tx);
    await insertSeedData(tx, buildSeedData(today));
    return countData(tx);
  }, TRANSACTION_OPTIONS);
}
