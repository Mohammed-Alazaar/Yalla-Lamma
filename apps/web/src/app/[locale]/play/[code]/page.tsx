import { PlayerScreen } from "@/components/realtime/player-screen";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PlayerScreen code={code.toUpperCase()} />;
}
