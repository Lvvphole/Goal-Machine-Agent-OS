import { createServiceClient } from "@/lib/db/supabase";
import { ConfidenceScore, ConfidenceComponents } from "@/lib/schemas";

type ConfidenceRoute = "auto_apply" | "suggest" | "escalate" | "reject";

const WEIGHTS = {
  evidence_quality: 0.35,
  evidence_quantity: 0.20,
  domain_match: 0.25,
  user_data_density: 0.20,
} as const;

const DECAY_RATE = 0.02;
const DECAY_FLOOR = 0.30;

const ROUTE_THRESHOLDS: Record<ConfidenceRoute, number> = {
  auto_apply: 0.75,
  suggest: 0.55,
  escalate: 0.35,
  reject: 0,
};

function labelFromScore(overall: number): ConfidenceScore["label"] {
  if (overall >= 0.65) return "high";
  if (overall >= 0.40) return "moderate";
  return "low";
}

export class ConfidenceEngine {
  private readonly db = createServiceClient();

  async score(
    goalId: string,
    evidenceQuality: number,
    evidenceQuantity: number,
    domainMatch: number,
    userDataDensity: number,
  ): Promise<ConfidenceScore> {
    const overall = Math.min(
      1,
      Math.max(
        0,
        evidenceQuality * WEIGHTS.evidence_quality +
          evidenceQuantity * WEIGHTS.evidence_quantity +
          domainMatch * WEIGHTS.domain_match +
          userDataDensity * WEIGHTS.user_data_density,
      ),
    );

    const components: ConfidenceComponents = {
      evidence_quality: evidenceQuality,
      action_controllability: domainMatch,
      timeline_realism: evidenceQuantity,
      motivation_alignment: userDataDensity,
      environment_support: (evidenceQuality + domainMatch + userDataDensity) / 3,
    };

    const result: ConfidenceScore = {
      components,
      overall,
      label: labelFromScore(overall),
      computed_at: new Date().toISOString(),
    };

    // Write the audit row (now with goal_id attached so it's no longer orphaned).
    const { error: scoresError } = await this.db.from("confidence_scores").insert({
      goal_id: goalId,
      components,
      overall,
      label: result.label,
      computed_at: result.computed_at,
    });
    if (scoresError) {
      console.error("confidence_scores insert failed:", scoresError.message);
    }

    // Mirror overall onto goals.confidence so /api/goals/create and the dashboard
    // can read it in a single SELECT without joining confidence_scores.
    const { error: goalsError } = await this.db
      .from("goals")
      .update({
        confidence: overall,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId);
    if (goalsError) {
      console.error("goals.confidence update failed:", goalsError.message);
    }

    return result;
  }

  async decay(
    original: ConfidenceScore,
    daysSinceGeneration: number,
  ): Promise<ConfidenceScore> {
    const decayed = Math.max(
      DECAY_FLOOR,
      original.overall * Math.pow(1 - DECAY_RATE, daysSinceGeneration),
    );

    const scale = original.overall > 0 ? decayed / original.overall : 1;
    const components: ConfidenceComponents = {
      evidence_quality: original.components.evidence_quality * scale,
      action_controllability: original.components.action_controllability * scale,
      timeline_realism: original.components.timeline_realism * scale,
      motivation_alignment: original.components.motivation_alignment * scale,
      environment_support: original.components.environment_support * scale,
    };

    return {
      components,
      overall: decayed,
      label: labelFromScore(decayed),
      computed_at: new Date().toISOString(),
    };
  }

  async route(confidence: ConfidenceScore): Promise<ConfidenceRoute> {
    const { overall } = confidence;
    if (overall >= ROUTE_THRESHOLDS.auto_apply) return "auto_apply";
    if (overall >= ROUTE_THRESHOLDS.suggest) return "suggest";
    if (overall >= ROUTE_THRESHOLDS.escalate) return "escalate";
    return "reject";
  }
}
