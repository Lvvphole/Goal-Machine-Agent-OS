import { z } from "zod";

export const GoalDomainSchema = z.enum([
  "health",
  "finance",
  "career",
  "relationship",
  "learning",
  "creative",
  "other",
]);

export const GoalTypeSchema = z.enum([
  "outcome",
  "habit",
  "project",
  "learning",
  "performance",
]);

export const GoalClassificationSchema = z.object({
  domain: GoalDomainSchema,
  goal_type: GoalTypeSchema,
  metric_unit: z.string().min(1),
  target_delta: z.number(),
  timeframe_days: z.number().int().positive(),
  base_rate_success: z.number().min(0).max(1),
  base_rate_source: z.string().min(1),
  involves_other_person: z.boolean(),
  controllable_daily_action: z.boolean(),
  risk_flags: z.array(z.string()),
  recommended_corpus_tags: z.array(z.string()),
});

export type GoalDomain = z.infer<typeof GoalDomainSchema>;
export type GoalType = z.infer<typeof GoalTypeSchema>;
export type GoalClassification = z.infer<typeof GoalClassificationSchema>;
