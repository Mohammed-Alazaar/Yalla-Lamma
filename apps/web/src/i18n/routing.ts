import { defineRouting } from "next-intl/routing";

/**
 * Locales served by the app. English is the default; Arabic is the RTL locale
 * whose translations land in v2 (the plumbing must work in v1 — see PRD §10.5).
 */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
});

export type AppLocale = (typeof routing.locales)[number];

/** Locales that render right-to-left. */
const RTL_LOCALES: readonly string[] = ["ar", "he", "fa", "ur"];

/** Text direction for a given locale; used to set <html dir> (PRD I18N-4). */
export function getLocaleDir(locale: string): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}
