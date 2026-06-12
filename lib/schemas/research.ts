import { z } from "zod";

export const EvidenceRecordSchema = z.object({
  source: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  relevance_score: z.number().min(0).max(1),
  url: z.string().url().optional(),
  published_date: z.string().datetime().optional(),
});

export const EvidenceBundleSchema = z.object({
  records: z.array(EvidenceRecordSchema),
  total_sources: z.number().int().nonnegative(),
  retrieval_date: z.string().datetime(),
});

export const RecommendedActionSchema = z.object({
  action: z.string().min(1),
  rationale: z.string().min(1),
  frequency: z.string().min(1),
  effort_level: z.enum(["low", "medium", "high"]),
  evidence_strength: z.enum(["weak", "moderate", "strong"]),
});

export const FailureModeSchema = z.object({
  mode: z.string().min(1),
  probability: z.number().min(0).max(1),
  mitigation: z.string().min(1),
});

export const ResearchBundleSchema = z.object({
  evidence: EvidenceBundleSchema,
  recommended_actions: z.array(RecommendedActionSchema),
  failure_modes: z.array(FailureModeSchema),
  synthesis: z.string().min(1),
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
export type RecommendedAction = z.infer<typeof RecommendedActionSchema>;
export type FailureMode = z.infer<typeof FailureModeSchema>;
export type ResearchBundle = z.infer<typeof ResearchBundleSchema>;
