"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { initAnalytics } from "@/lib/analytics";

/** Client-only app shell: analytics init + global toast host. */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <>
      {children}
      <Toaster richColors position="top-center" />
    </>
  );
}
