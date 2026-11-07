import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

/**
 * Загружает .env из корня проекта. Уже заданные переменные окружения
 * не перезаписываются: так можно явно указать другую базу для одной команды.
 */
export function loadDotEnv(path: string = resolve(process.cwd(), ".env")): void {
  if (!existsSync(path)) return;
  const values = parseEnv(readFileSync(path, "utf8"));
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined && value !== undefined) {
      process.env[key] = value;
    }
  }
}
