import { headers } from "next/headers";
import { HostScreen } from "@/components/realtime/host-screen";

export default async function HostPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Derive the public origin from the request so the QR deep-link is absolute
  // (hydration-safe — no window access in the client component).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  return <HostScreen code={code.toUpperCase()} origin={origin} />;
}
