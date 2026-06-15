import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Browser-side error capture only. Performance tracing disabled by default
  // (Sentry's free tier is for errors; tracing burns the quota fast).
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  // Suppress noise: don't capture errors thrown by browser extensions.
  ignoreErrors: [
    /ResizeObserver loop limit exceeded/,
    /Non-Error promise rejection captured/,
  ],
});
