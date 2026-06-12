import { z } from "zod";

export const EscalationTriggerSchema = z.enum([
  "MISSED_CHECKINS",
  "STALLED_METRIC",
  "CONFIDENCE_DROP",
  "STATE_LOOP",
  "DEADLINE_PROXIMITY",
  "USER_REQUEST",
  "SYSTEM_ANOMALY",
]);

export type EscalationTrigger = z.infer<typeof EscalationTriggerSchema>;

export const EscalationSchema = z.object({
  id: z.string().uuid(),
  goal_id: z.string().uuid(),
  trigger: EscalationTriggerSchema,
  triggered_at: z.string().datetime(),
  description: z.string().min(1),
  resolved: z.boolean(),
  resolved_at: z.string().datetime().optional(),
  resolution_notes: z.string().optional(),
});

export type Escalation = z.infer<typeof EscalationSchema>;
