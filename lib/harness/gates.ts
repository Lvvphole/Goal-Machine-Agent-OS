import { z } from "zod";
import {
  GoalClassification,
  GoalClassificationSchema,
  GoalInput,
  GoalInputSchema,
  GoalMachineConfig,
  GoalMachineConfigSchema,
  ResearchBundle,
  ResearchBundleSchema,
} from "@/lib/schemas";

export class GateError extends Error {
  constructor(
    readonly gate: "gate1Input" | "gate2BaseRate" | "gate3Evidence" | "gate4Output",
    message: string,
    readonly issues?: z.ZodIssue[],
  ) {
    super(`${gate}: ${message}`);
    this.name = "GateError";
  }
}

export function gate1Input(input: unknown): GoalInput {
  const parsed = GoalInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new GateError("gate1Input", "Goal input failed schema validation", parsed.error.issues);
  }

  const deadline = new Date(parsed.data.deadline).getTime();
  if (deadline <= Date.now()) {
    throw new GateError("gate1Input", "Goal deadline must be in the future");
  }

  if (parsed.data.current_value === parsed.data.target_value) {
    throw new GateError("gate1Input", "Current value already equals target value");
  }

  return parsed.data;
}

export function gate2BaseRate(classification: unknown): GoalClassification {
  const parsed = GoalClassificationSchema.safeParse(classification);
  if (!parsed.success) {
    throw new GateError("gate2BaseRate", "Classification failed schema validation", parsed.error.issues);
  }

  if (parsed.data.base_rate_success < 0.05) {
    throw new GateError("gate2BaseRate", "Base rate is too low for automatic plan generation");
  }

  if (!parsed.data.base_rate_source.trim()) {
    throw new GateError("gate2BaseRate", "Base rate source is required");
  }

  return parsed.data;
}

export function gate3Evidence(research: unknown): ResearchBundle {
  const parsed = ResearchBundleSchema.safeParse(research);
  if (!parsed.success) {
    throw new GateError("gate3Evidence", "Research bundle failed schema validation", parsed.error.issues);
  }

  const { evidence, recommended_actions } = parsed.data;
  const relevantRecords = evidence.records.filter((record) => record.relevance_score >= 0.5);
  if (evidence.total_sources < 2 || relevantRecords.length < 2) {
    throw new GateError("gate3Evidence", "At least two relevant evidence sources are required");
  }

  if (recommended_actions.length === 0) {
    throw new GateError("gate3Evidence", "At least one evidence-backed recommended action is required");
  }

  return parsed.data;
}

export function gate4Output(config: unknown): GoalMachineConfig {
  const parsed = GoalMachineConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new GateError("gate4Output", "Generated config failed schema validation", parsed.error.issues);
  }

  if (parsed.data.actions.length === 0) {
    throw new GateError("gate4Output", "Generated config must include at least one action");
  }

  if (parsed.data.check_in_cadence_days > parsed.data.escalation_threshold_days) {
    throw new GateError(
      "gate4Output",
      "Check-in cadence cannot be longer than the escalation threshold",
    );
  }

  return parsed.data;
}
