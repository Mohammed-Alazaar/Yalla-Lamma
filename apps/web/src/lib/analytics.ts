"use client";

import posthog from "posthog-js";

let started = false;

/** Initialize PostHog once, only when a key is configured (no-op otherwise). */
export function initAnalytics(): void {
  if (started || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: true,
    autocapture: false,
    person_profiles: "identified_only",
  });
  started = true;
}

/** Capture a product event (no-op until PostHog is configured). */
export function capture(event: string, props?: Record<string, unknown>): void {
  if (!started) return;
  posthog.capture(event, props);
}
