import { getTranslations, setRequestLocale } from "next-intl/server";
import { JoinForm } from "@/components/realtime/join-form";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("join");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <JoinForm />
    </main>
  );
}
