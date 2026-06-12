import { z } from "zod";

export const ConfidenceComponentsSchema = z.object({
  evidence_quality: z.number().min(0).max(1),
  action_controllability: z.number().min(0).max(1),
  timeline_realism: z.number().min(0).max(1),
  motivation_alignment: z.number().min(0).max(1),
  environment_support: z.number().min(0).max(1),
});

export const ConfidenceScoreSchema = z.object({
  components: ConfidenceComponentsSchema,
  overall: z.number().min(0).max(1),
  label: z.enum(["low", "moderate", "high"]),
  computed_at: z.string().datetime(),
});

export type ConfidenceComponents = z.infer<typeof ConfidenceComponentsSchema>;
export type ConfidenceScore = z.infer<typeof ConfidenceScoreSchema>;
