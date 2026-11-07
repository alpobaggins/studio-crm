import { connection } from "next/server";
import { getAppTimeZone, todayInTimeZone } from "@/lib/dates";

/**
 * Сегодняшняя дата в часовом поясе приложения для серверных компонентов (Plan.md 1.7).
 * `connection()` переносит чтение текущего времени на время запроса: с `cacheComponents` без этого
 * Next отказывается строить страницу. Сервисы и тесты вызывают `todayInTimeZone` напрямую.
 */
export async function getAppToday(): Promise<{ today: Date; timeZone: string }> {
  await connection();
  const timeZone = getAppTimeZone();
  return { today: todayInTimeZone(timeZone), timeZone };
}
