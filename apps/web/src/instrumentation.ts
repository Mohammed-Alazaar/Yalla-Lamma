// Server-side instrumentation (Next.js `register` hook). Initializes Sentry for
// the Node runtime only when a DSN is configured (otherwise a no-op).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  }
}

/** Capture App Router server errors (Next.js `onRequestError` hook). */
export async function onRequestError(error: unknown): Promise<void> {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/node");
    Sentry.captureException(error);
  }
}
