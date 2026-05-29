import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");
  const nav = await getTranslations("nav");

  const steps = [t("steps.one"), t("steps.two"), t("steps.three")];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6">
        <span className="text-lg font-bold tracking-tight">{nav("brand")}</span>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-12 px-6 py-12 text-center">
        <section className="flex flex-col items-center gap-6">
          <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
            {t("tagline")}
          </h1>
          <p className="max-w-2xl text-balance text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="min-h-12 text-base">
              <Link href="/host">{t("createRoom")}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="min-h-12 text-base">
              <Link href="/join">{t("joinRoom")}</Link>
            </Button>
          </div>
        </section>

        <section className="w-full max-w-3xl">
          <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {t("steps.title")}
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li
                key={i}
                className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <p className="text-sm text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <Footer />
    </div>
  );
}
