"use client";

import { useEffect } from "react";

/** Root error boundary — reports to Sentry (if configured) and shows a fallback. */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (dsn) {
      void import("@sentry/browser").then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
        }}
      >
        <p>Something went wrong. Please refresh.</p>
      </body>
    </html>
  );
}
