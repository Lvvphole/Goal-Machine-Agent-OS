import { z } from "zod";
import { GoalMachineConfigSchema } from "./config-output";

export const VersionDiffSchema = z.object({
  field: z.string().min(1),
  old_value: z.unknown(),
  new_value: z.unknown(),
  changed_at: z.string().datetime(),
  changed_by: z.string().optional(),
});

export const ConfigVersionSchema = z.object({
  version_number: z.number().int().positive(),
  config: GoalMachineConfigSchema,
  diffs: z.array(VersionDiffSchema),
  created_at: z.string().datetime(),
  rationale: z.string().min(1),
});

export type VersionDiff = z.infer<typeof VersionDiffSchema>;
export type ConfigVersion = z.infer<typeof ConfigVersionSchema>;
