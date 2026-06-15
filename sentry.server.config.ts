import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Server-side capture for API route exceptions, harness failures, and any
  // unhandled error in node runtime.
  tracesSampleRate: 0,
  // Send environment tag so the dashboard separates preview/prod deploys.
  environment: process.env.VERCEL_ENV ?? "development",
});
