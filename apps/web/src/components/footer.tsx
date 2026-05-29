import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
        <p className="text-center sm:text-start">{t("tagline")}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide">{t("language")}</span>
          <LocaleSwitcher />
        </div>
      </div>
    </footer>
  );
}
