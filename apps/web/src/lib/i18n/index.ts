import { en } from "./en";
import { id, type Dictionary } from "./id";

export const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "id";

const dictionaries: Record<Locale, Dictionary> = { id, en };

export function getDictionary(locale: string | null | undefined): Dictionary {
  return dictionaries[(LOCALES as readonly string[]).includes(locale ?? "") ? (locale as Locale) : DEFAULT_LOCALE];
}

export type { Dictionary };
