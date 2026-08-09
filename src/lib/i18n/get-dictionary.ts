import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/config";
import az, { type Dictionary } from "@/lib/i18n/dictionaries/az";
import en from "@/lib/i18n/dictionaries/en";

const dictionaries: Record<Locale, Dictionary> = { az, en };

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDictionary(): Promise<Dictionary> {
  const locale = await getLocale();
  return dictionaries[locale];
}

export type { Dictionary, Locale };
