import { z } from "zod";

export const GoalStateSchema = z.enum([
  "setup",
  "active",
  "correcting",
  "breaker",
  "stalled",
  "rebuilding",
  "escalated",
  "completed",
  "abandoned",
]);

export type GoalState = z.infer<typeof GoalStateSchema>;

export const TRANSITIONS: Record<GoalState, GoalState[]> = {
  setup:      ["active"],
  active:     ["correcting", "stalled", "escalated", "completed", "abandoned"],
  correcting: ["active", "breaker", "escalated"],
  breaker:    ["active", "correcting", "escalated", "abandoned"],
  stalled:    ["rebuilding", "escalated", "abandoned"],
  rebuilding: ["active", "correcting", "escalated", "abandoned"],
  escalated:  ["active", "correcting", "abandoned"],
  completed:  [],
  abandoned:  [],
};

export const StateTransitionSchema = z.object({
  from: GoalStateSchema,
  to: GoalStateSchema,
  timestamp: z.string().datetime(),
  reason: z.string().min(1),
});

export const GoalMachineStateSchema = z.object({
  goal_id: z.string().uuid(),
  current_state: GoalStateSchema,
  history: z.array(StateTransitionSchema),
  entered_at: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type StateTransition = z.infer<typeof StateTransitionSchema>;
export type GoalMachineState = z.infer<typeof GoalMachineStateSchema>;
