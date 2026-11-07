const pluralRules = new Intl.PluralRules("ru-RU");

/** Форма слова для числа: forms — [одна, несколько, много]. */
export function pluralForm(count: number, forms: [string, string, string]): string {
  const rule = pluralRules.select(count);
  return rule === "one" ? forms[0] : rule === "few" ? forms[1] : forms[2];
}

/** «1 контакт», «2 контакта», «5 контактов». forms: [одна, несколько, много]. */
export function pluralRu(count: number, forms: [string, string, string]): string {
  return `${count} ${pluralForm(count, forms)}`;
}

/**
 * Последствие удаления для диалога подтверждения, с согласованием глагола и числа:
 * «Вместе с лидом будет удалена 1 активность», «… будут удалены 2 активности», «… будут удалены 5 активностей».
 * Без активностей — только предупреждение о необратимости.
 */
export function deleteConsequences(withWhom: string, activities: number): string {
  const cascade =
    activities > 0
      ? `Вместе с ${withWhom} ${pluralForm(activities, ["будет удалена", "будут удалены", "будут удалены"])} ` +
        `${pluralRu(activities, ["активность", "активности", "активностей"])}. `
      : "";
  return `${cascade}Действие нельзя отменить.`;
}

/** Ссылка на сайт: если схема не указана, добавляется https://. */
export function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

const moneyFormat = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 });
const moneyFormatWhole = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });

/** «1 500 000 ₽»; копейки показываются, только если они есть (DESIGN.md 7). Принимает строку Decimal. */
export function formatMoney(value: string | number): string {
  const amount = Number(value);
  return Number.isInteger(amount) ? moneyFormatWhole.format(amount) : moneyFormat.format(amount);
}

// Даты без времени хранятся как полночь UTC, поэтому форматируются в UTC — без сдвига на сутки.
const longDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** «7 ноября 2026» — для дат без времени (`@db.Date`). */
export function formatDate(date: Date): string {
  return longDate.format(date).replace(/\s*г\.$/, "");
}

/** Дата момента времени (createdAt и т. п.) в часовом поясе приложения: «07.11.2026». */
export function formatShortDateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(date);
}

/** «7 ноября 2026» для момента времени в часовом поясе приложения. */
export function formatDateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone })
    .format(date)
    .replace(/\s*г\.$/, "");
}

/** Дата без времени для `<input type="date">`: «2026-11-07». */
export function dateInputValue(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString().slice(0, 10) : undefined;
}
