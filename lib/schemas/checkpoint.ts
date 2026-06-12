import { z } from "zod";
import { ConfidenceScoreSchema } from "./confidence";
import { GoalStateSchema } from "./state";

export const StateCheckpointSchema = z.object({
  goal_id: z.string().uuid(),
  checkpoint_at: z.string().datetime(),
  state: GoalStateSchema,
  metric_value: z.number(),
  confidence: ConfidenceScoreSchema,
  notes: z.string().optional(),
  next_check_in: z.string().datetime(),
});

export type StateCheckpoint = z.infer<typeof StateCheckpointSchema>;
