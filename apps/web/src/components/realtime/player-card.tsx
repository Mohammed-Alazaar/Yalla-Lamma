import { useTranslations } from "next-intl";
import type { PublicPlayer } from "@yalla/shared";
import { cn } from "@/lib/utils";

export function PlayerCard({ player }: { player: PublicPlayer }) {
  const t = useTranslations("host");
  return (
    <div
      className={cn(
        "flex min-w-32 flex-col items-center gap-2 rounded-xl border-2 bg-card p-4 transition-opacity",
        !player.connected && "opacity-40",
      )}
      style={{ borderColor: player.color }}
    >
      <span
        className="flex size-12 items-center justify-center rounded-full text-xl font-bold text-white"
        style={{ backgroundColor: player.color }}
        aria-hidden
      >
        {player.name.charAt(0).toUpperCase()}
      </span>
      <span className="max-w-32 truncate font-semibold">{player.name}</span>
      {player.isVip && (
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("vip")}
        </span>
      )}
    </div>
  );
}
