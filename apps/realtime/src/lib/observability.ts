// Env-gated observability for the realtime tier. The SDKs are imported
// dynamically only when their env vars are set, so local dev and tests never
// load them. Errors fall back to console; analytics are silently dropped.

type SentryModule = typeof import("@sentry/node");
type PostHogClient = InstanceType<typeof import("posthog-node").PostHog>;

let sentry: SentryModule | null = null;
let posthog: PostHogClient | null = null;

/** Initialize Sentry + PostHog if configured. Call once at startup. */
export async function initObservability(): Promise<void> {
  if (process.env.SENTRY_DSN) {
    sentry = await import("@sentry/node");
    sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  }
  if (process.env.POSTHOG_KEY) {
    const { PostHog } = await import("posthog-node");
    posthog = new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
    });
  }
}

/** Report an error to Sentry, or log it when Sentry isn't configured. */
export function captureError(err: unknown): void {
  if (sentry) sentry.captureException(err);
  else console.error("[realtime] error:", err);
}

/** Capture a product analytics event (no-op without PostHog configured). */
export function captureEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  posthog?.capture({ distinctId, event, properties });
}

/** Flush buffered analytics before shutdown. */
export async function shutdownObservability(): Promise<void> {
  await posthog?.shutdown();
}
