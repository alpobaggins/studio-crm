// Запускает команду с DATABASE_URL, подменённым на TEST_DATABASE_URL (только studio_crm_agent).
// Пример: tsx scripts/with-test-db.ts node --test ...
import { spawn } from "node:child_process";
import { resolveTestDatabaseUrl } from "./lib/db-guards";
import { loadDotEnv } from "./lib/load-env";

loadDotEnv();

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Укажите команду: tsx scripts/with-test-db.ts <команда> [аргументы]");
  process.exit(1);
}

let testUrl: string;
try {
  testUrl = resolveTestDatabaseUrl(process.env);
} catch (error) {
  console.error(`Отказ: ${(error as Error).message}`);
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl },
});
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
child.on("error", (error) => {
  console.error(`Не удалось запустить «${command}»: ${error.message}`);
  process.exit(1);
});
