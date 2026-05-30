import { useTranslations } from "next-intl";
import type { PublicPlayer } from "@yalla/shared";
import { cn } from "@/lib/utils";

export function PlayerCard({
  player,
  onKick,
}: {
  player: PublicPlayer;
  onKick?: (playerId: string) => void;
}) {
  const t = useTranslations("host");
  return (
    <div
      className={cn(
        "relative flex min-w-32 flex-col items-center gap-2 rounded-xl border-2 bg-card p-4 transition-opacity",
        !player.connected && "opacity-40",
      )}
      style={{ borderColor: player.color }}
    >
      {onKick && (
        <button
          type="button"
          onClick={() => onKick(player.id)}
          aria-label={t("kick", { name: player.name })}
          className="absolute end-1 top-1 flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
        >
          ×
        </button>
      )}
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
