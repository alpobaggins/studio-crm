// Точка входа seed/reset.
//   npm run db:seed   → prisma db seed            — контрольные данные только в пустую базу
//   npm run db:reset  → tsx prisma/seed.ts --reset — очистка строк и загрузка контрольных данных
// Reset запускается напрямую, а не через prisma db seed: Prisma не передаёт скрипту терминал,
// и подтверждение было бы невозможно.
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { getAppTimeZone, todayInTimeZone } from "../src/lib/dates";
import {
  databaseNameFromUrl,
  isLocalDatabaseUrl,
  isResetConfirmed,
  parseSeedArgs,
  resetConfirmationMode,
} from "../scripts/lib/db-guards";
import { loadDotEnv } from "../scripts/lib/load-env";
import { resetDatabase, seedEmptyDatabase, type DataCounts } from "./seed/run";

async function confirmReset(databaseName: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `Сброс удалит все лиды, компании, контакты, сделки и активности в базе «${databaseName}» ` +
        "и загрузит демонстрационные данные. Схема и стадии сохранятся.\n" +
        "Введите «да», чтобы продолжить: ",
    );
    return isResetConfirmed(answer);
  } finally {
    rl.close();
  }
}

function formatCounts(c: DataCounts): string {
  return `лидов ${c.leads}, компаний ${c.accounts}, контактов ${c.contacts}, сделок ${c.opportunities}, активностей ${c.activities}`;
}

async function main(): Promise<void> {
  loadDotEnv();
  const { reset } = parseSeedArgs(process.argv.slice(2));

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Не задана переменная DATABASE_URL (см. .env.example).");
  if (!isLocalDatabaseUrl(url)) {
    throw new Error("Seed и reset работают только с локальной базой данных.");
  }
  const databaseName = databaseNameFromUrl(url);

  if (reset) {
    const mode = resetConfirmationMode({
      databaseName,
      isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    });
    if (mode === "refuse") {
      throw new Error(
        `Сброс базы «${databaseName}» требует подтверждения в интерактивном терминале. ` +
          "Запустите npm run db:reset в терминале.",
      );
    }
    if (mode === "ask" && !(await confirmReset(databaseName))) {
      throw new Error("Сброс отменён, данные не изменены.");
    }
  }

  const today = todayInTimeZone(getAppTimeZone());
  const prisma = new PrismaClient();
  try {
    const counts = reset
      ? await resetDatabase(prisma, today)
      : await seedEmptyDatabase(prisma, today);
    console.log(
      `${reset ? "Демонстрационные данные восстановлены" : "Демонстрационные данные загружены"} ` +
        `в базу «${databaseName}»: ${formatCounts(counts)}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
