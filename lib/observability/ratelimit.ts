import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Configured rate limiters keyed by user_id. Returns null when Upstash env vars
// aren't set so local dev doesn't require Redis. Production sets these via the
// Vercel + Upstash integration.

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

/**
 * Goal-creation rate limit: 5 attempts per user per rolling hour.
 * Sliding window prevents burst right after each window boundary.
 * Override via env: RATELIMIT_GOAL_CREATE_HOUR (default 5).
 */
export const goalCreationRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        Number(process.env.RATELIMIT_GOAL_CREATE_HOUR ?? 5),
        "1 h",
      ),
      analytics: true,
      prefix: "goal-machine:create",
    })
  : null;

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};
