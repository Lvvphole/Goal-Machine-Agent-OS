import { createServiceClient } from "@/lib/db/supabase";
import {
  EscalationTrigger,
  EscalationSchema,
  Escalation,
  GoalMachineState,
} from "@/lib/schemas";

export type DegradationTier = "full" | "conservative" | "manual_only" | "suspended";

const DEGRADATION_THRESHOLDS: Array<{ min: number; tier: DegradationTier }> = [
  { min: 0.75, tier: "full" },
  { min: 0.55, tier: "conservative" },
  { min: 0.35, tier: "manual_only" },
  { min: 0, tier: "suspended" },
];

export class EscalationRouter {
  private readonly db = createServiceClient();

  async escalate(
    trigger: EscalationTrigger,
    state: GoalMachineState,
    partialOutput?: Record<string, unknown>,
  ): Promise<Escalation> {
    const { data, error } = await this.db
      .from("escalations")
      .insert({
        goal_id: state.goal_id,
        trigger,
        triggered_at: new Date().toISOString(),
        description: this.describeEscalation(trigger, state, partialOutput),
        resolved: false,
        resolved_at: null,
        resolution_notes: null,
      })
      .select()
      .single();

    if (error) throw new Error(`escalate failed: ${error.message}`);
    return EscalationSchema.parse(data);
  }

  async resolve(
    escalationId: string,
    resolution: string,
  ): Promise<Escalation> {
    const { data, error } = await this.db
      .from("escalations")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolution,
      })
      .eq("id", escalationId)
      .select()
      .single();

    if (error) throw new Error(`resolve failed: ${error.message}`);
    return EscalationSchema.parse(data);
  }

  async degrade(confidence: number): Promise<DegradationTier> {
    for (const { min, tier } of DEGRADATION_THRESHOLDS) {
      if (confidence >= min) return tier;
    }
    return "suspended";
  }

  private describeEscalation(
    trigger: EscalationTrigger,
    state: GoalMachineState,
    partialOutput?: Record<string, unknown>,
  ): string {
    const base = `Escalation triggered by ${trigger} on goal ${state.goal_id} in state ${state.current_state}`;
    if (!partialOutput) return base;
    return `${base}. Partial output: ${JSON.stringify(partialOutput)}`;
  }
}
