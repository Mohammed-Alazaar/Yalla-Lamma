"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Native language names — shown in each language's own script, so not translated.
const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  ar: "العربية",
};

export function LocaleSwitcher() {
  const activeLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchTo(nextLocale: string) {
    if (nextLocale === activeLocale) return;
    startTransition(() => {
      // `pathname` excludes the locale prefix; the router re-applies it.
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center gap-1 rounded-full border border-border p-1"
    >
      {routing.locales.map((locale) => {
        const isActive = locale === activeLocale;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => switchTo(locale)}
            aria-current={isActive}
            disabled={isPending}
            className={cn(
              "min-h-9 rounded-full px-3 text-sm font-medium transition-colors disabled:opacity-60",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LOCALE_LABELS[locale] ?? locale}
          </button>
        );
      })}
    </div>
  );
}
