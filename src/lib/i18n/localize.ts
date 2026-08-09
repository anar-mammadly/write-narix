import type { Locale } from "@/lib/i18n/config";

// DB content (services, categories, levels, deadlines, languages, add-ons,
// faqs, testimonials) is authored in Azerbaijani directly on its base
// columns. A `translations` jsonb column holds locale-keyed overrides for
// just the fields that differ, e.g. {"en": {"name": "Essay"}} — any
// field/locale it doesn't have falls back to the AZ base column.
export function localizeRow<T extends { translations?: unknown }>(
  row: T,
  locale: Locale,
  fields: (keyof T)[]
): T {
  if (locale === "az") return row;
  const translations = row.translations as Record<string, Record<string, string>> | null | undefined;
  const override = translations?.[locale];
  if (!override) return row;

  const result = { ...row };
  for (const field of fields) {
    const value = override[field as string];
    if (value !== undefined) {
      (result as Record<string, unknown>)[field as string] = value;
    }
  }
  return result;
}

export function localizeRows<T extends { translations?: unknown }>(
  rows: T[],
  locale: Locale,
  fields: (keyof T)[]
): T[] {
  return rows.map((row) => localizeRow(row, locale, fields));
}
