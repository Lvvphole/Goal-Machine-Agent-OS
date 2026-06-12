import { z } from "zod";
import { ActionItemSchema, GoalMachineConfigSchema } from "./config-output";
import { GoalMachineStateSchema } from "./state";

export const CorrectionRequestSchema = z.object({
  goal_id: z.string().uuid(),
  state_snapshot: GoalMachineStateSchema,
  trigger_reason: z.string().min(1),
  requested_at: z.string().datetime(),
});

export const PriorityReshuffleSchema = z.object({
  old_priorities: z.array(z.string()),
  new_priorities: z.array(z.string()),
  rationale: z.string().min(1),
});

export const ConvergencePhaseSchema = z.object({
  phase_name: z.string().min(1),
  duration_days: z.number().int().positive(),
  daily_actions: z.array(ActionItemSchema),
  success_criteria: z.string().min(1),
});

export const CorrectionResponseSchema = z.object({
  request_id: z.string().uuid(),
  new_actions: z.array(ActionItemSchema),
  priority_reshuffle: PriorityReshuffleSchema.optional(),
  convergence_phase: ConvergencePhaseSchema,
  updated_config: GoalMachineConfigSchema,
  response_at: z.string().datetime(),
});

export type CorrectionRequest = z.infer<typeof CorrectionRequestSchema>;
export type PriorityReshuffle = z.infer<typeof PriorityReshuffleSchema>;
export type ConvergencePhase = z.infer<typeof ConvergencePhaseSchema>;
export type CorrectionResponse = z.infer<typeof CorrectionResponseSchema>;
