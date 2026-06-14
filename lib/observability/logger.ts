import pino from "pino";

// Structured logger. JSON output to stdout; Vercel ingests automatically.
// Log level via env: LOG_LEVEL=debug for verbose, info (default) for production.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: "goal-machine",
    env: process.env.VERCEL_ENV ?? "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
