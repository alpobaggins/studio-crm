const pluralRules = new Intl.PluralRules("ru-RU");

/** «1 контакт», «2 контакта», «5 контактов». forms: [одна, несколько, много]. */
export function pluralRu(count: number, forms: [string, string, string]): string {
  const rule = pluralRules.select(count);
  const form = rule === "one" ? forms[0] : rule === "few" ? forms[1] : forms[2];
  return `${count} ${form}`;
}

/** Ссылка на сайт: если схема не указана, добавляется https://. */
export function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}
