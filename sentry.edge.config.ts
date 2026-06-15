import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Edge runtime (middleware.ts). Lighter sampling — most errors here are
  // auth/cookie issues which are usually expected.
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? "development",
});
