import { z } from "zod";

export const ActionItemSchema = z.object({
  id: z.string().uuid(),
  action: z.string().min(1),
  frequency: z.string().min(1),
  trigger: z.string().min(1),
  duration_minutes: z.number().int().positive(),
  priority: z.number().int().min(1),
});

export const BackupPlanSchema = z.object({
  condition: z.string().min(1),
  alternative_action: z.string().min(1),
  notes: z.string().optional(),
});

export const FrictionScoreSchema = z.object({
  score: z.number().min(0).max(10),
  factors: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const EnvironmentDesignSchema = z.object({
  additions: z.array(z.string()),
  removals: z.array(z.string()),
  cues: z.array(z.string()),
});

export const DisplayMetricSchema = z.object({
  label: z.string().min(1),
  unit: z.string().min(1),
  current: z.number(),
  target: z.number(),
  direction: z.enum(["up", "down"]),
});

export const GoalMachineConfigSchema = z.object({
  goal_id: z.string().uuid(),
  created_at: z.string().datetime(),
  actions: z.array(ActionItemSchema),
  backup_plans: z.array(BackupPlanSchema),
  friction_score: FrictionScoreSchema,
  environment_design: EnvironmentDesignSchema,
  display_metric: DisplayMetricSchema,
  check_in_cadence_days: z.number().int().positive(),
  escalation_threshold_days: z.number().int().positive(),
});

export type ActionItem = z.infer<typeof ActionItemSchema>;
export type BackupPlan = z.infer<typeof BackupPlanSchema>;
export type FrictionScore = z.infer<typeof FrictionScoreSchema>;
export type EnvironmentDesign = z.infer<typeof EnvironmentDesignSchema>;
export type DisplayMetric = z.infer<typeof DisplayMetricSchema>;
export type GoalMachineConfig = z.infer<typeof GoalMachineConfigSchema>;
