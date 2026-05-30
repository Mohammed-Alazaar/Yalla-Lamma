"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@yalla/shared";
import { Button } from "@/components/ui/button";
import { bindSocket, emitWhenReady } from "@/lib/socket";
import { saveHostToken } from "@/lib/session-storage";

export function CreateRoomButton({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function createRoom() {
    setPending(true);
    const s = bindSocket();
    const onToken = (p: { hostToken: string; roomCode: string }) => {
      s.off("host:token", onToken);
      saveHostToken(p.roomCode, p.hostToken);
      router.push(`/host/${p.roomCode}`);
    };
    s.on("host:token", onToken);
    emitWhenReady("host:create", { locale });
  }

  return (
    <Button
      onClick={createRoom}
      disabled={pending}
      size="lg"
      className="min-h-12 text-base"
    >
      {label}
    </Button>
  );
}
