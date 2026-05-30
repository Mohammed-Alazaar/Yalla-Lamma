// Client error monitoring (Sentry). Loaded eagerly by Next before hydration.
// The DSN is a NEXT_PUBLIC_ build-time value, so when it's unset the guard is
// statically false and @sentry/browser is tree-shaken out of the bundle.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void import("@sentry/browser").then((Sentry) => {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NEXT_PUBLIC_ENV ?? "production",
    });
  });
}
