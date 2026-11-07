// Даты без времени (колонки @db.Date) представлены как Date на полночь UTC.
// «Сегодня» определяется по часовому поясу APP_TIME_ZONE (Plan.md 1.7).

export const DEFAULT_TIME_ZONE = "Europe/Moscow";

export function getAppTimeZone(env: Record<string, string | undefined> = process.env): string {
  const timeZone = env.APP_TIME_ZONE?.trim() || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
  } catch {
    throw new Error(`Некорректный часовой пояс APP_TIME_ZONE: «${timeZone}».`);
  }
  return timeZone;
}

/** Сегодняшняя дата в часовом поясе timeZone как Date на полночь UTC. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: "year" | "month" | "day") =>
    Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
