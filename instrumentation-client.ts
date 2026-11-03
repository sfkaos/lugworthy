// PostHog analytics. Runs once in the browser before the app hydrates (Next.js 15.3+).
// Without NEXT_PUBLIC_POSTHOG_KEY (local dev, previews) nothing loads.
// posthog-js is imported lazily so it stays out of the first-load bundle.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      // Same-origin proxy (see next.config.ts) so ad blockers don't drop events.
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com",
      // Page views on every client-side navigation, page leaves, and autocapture.
      defaults: "2025-05-24",
      // Anonymous visitors don't get person profiles (cheaper, more private).
      person_profiles: "identified_only",
    });
  });
}
