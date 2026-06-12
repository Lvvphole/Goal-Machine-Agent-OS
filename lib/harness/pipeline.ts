import { randomUUID } from "crypto";
import { z } from "zod";
import {
  Escalation,
  GoalClassificationSchema,
  GoalInput,
  GoalMachineConfig,
  GoalMachineConfigSchema,
  ResearchBundleSchema,
} from "@/lib/schemas";
import { ConfidenceEngine } from "@/lib/state/confidence";
import { GoalStateMachine } from "@/lib/state/machine";
import { ConfigVersionStore } from "@/lib/state/version-store";
import { ModelInput, ModelInterface } from "@/lib/models/interface";
import { gate1Input, gate2BaseRate, gate3Evidence, gate4Output, GateError } from "./gates";
import { ModelRole, ModelRouter } from "./model-router";
import { retryWithFeedback } from "./retry";

export type HarnessResult = GoalMachineConfig | Escalation;

const TEMPERATURE = 0.0;

class RoutedModel implements ModelInterface {
  constructor(private readonly router: ModelRouter, private readonly role: ModelRole) {}

  call: ModelInterface["call"] = (input, outputSchema, maxTokens, temperature) =>
    this.router.call(this.role, input, outputSchema, maxTokens, temperature);
}

export type GoalMachineHarnessOptions = {
  router?: ModelRouter;
  versionStore?: ConfigVersionStore;
  stateMachine?: GoalStateMachine;
  confidenceEngine?: ConfidenceEngine;
};

export class GoalMachineHarness {
  private readonly router: ModelRouter;
  private readonly versionStore: ConfigVersionStore;
  private readonly stateMachine: GoalStateMachine;
  private readonly confidenceEngine: ConfidenceEngine;

  constructor(options: GoalMachineHarnessOptions = {}) {
    this.router = options.router ?? new ModelRouter();
    this.versionStore = options.versionStore ?? new ConfigVersionStore();
    this.stateMachine = options.stateMachine ?? new GoalStateMachine();
    this.confidenceEngine = options.confidenceEngine ?? new ConfidenceEngine();
  }

  async run(goalInput: unknown): Promise<HarnessResult> {
    try {
      const input = gate1Input(goalInput);

      const classificationInput = this.classificationPrompt(input);
      const classification = gate2BaseRate(
        await this.callWithRetry("classifier", classificationInput, GoalClassificationSchema, 1200),
      );

      const researchInput = this.retrievalPrompt(input, classification);
      const research = gate3Evidence(
        await this.callWithRetry("retriever", researchInput, ResearchBundleSchema, 2500),
      );

      const generationInput = this.generationPrompt(input, classification, research);
      const config = gate4Output(
        await this.callWithRetry("generator", generationInput, GoalMachineConfigSchema, 3000),
      );

      await this.versionStore.create(config, "initial harness generation");
      await this.stateMachine.transition(config.goal_id, "active", "harness generated valid config");
      await this.confidenceEngine.score(
        this.evidenceQuality(research),
        Math.min(1, research.evidence.total_sources / 5),
        classification.controllable_daily_action ? 1 : 0.5,
        this.userDataDensity(input),
      );

      return config;
    } catch (error) {
      return this.toEscalation(error, goalInput);
    }
  }

  private async callWithRetry<TSchema extends z.ZodTypeAny>(
    role: ModelRole,
    input: ModelInput,
    schema: TSchema,
    maxTokens: number,
  ) {
    const model = new RoutedModel(this.router, role);
    try {
      return await model.call(input, schema, maxTokens, TEMPERATURE);
    } catch (error) {
      return retryWithFeedback(model, input, schema, error, 1, maxTokens, TEMPERATURE);
    }
  }

  private classificationPrompt(input: GoalInput): ModelInput {
    return [
      {
        role: "system",
        content: "Classify the goal for the Goal Machine harness. Use conservative base rates and cite the source name in base_rate_source.",
      },
      { role: "user", content: JSON.stringify(input) },
    ];
  }

  private retrievalPrompt(input: GoalInput, classification: unknown): ModelInput {
    return [
      {
        role: "system",
        content: "Retrieve and synthesize evidence for an evidence-backed plan. Prefer durable behavioral science and domain-specific evidence.",
      },
      {
        role: "user",
        content: JSON.stringify({ goal_input: input, classification }),
      },
    ];
  }

  private generationPrompt(input: GoalInput, classification: unknown, research: unknown): ModelInput {
    return [
      {
        role: "system",
        content: "Generate a GoalMachineConfig with concrete actions, backup plans, environment design, and validation-friendly UUIDs and ISO datetimes.",
      },
      {
        role: "user",
        content: JSON.stringify({ goal_input: input, classification, research }),
      },
    ];
  }

  private evidenceQuality(research: { evidence: { records: Array<{ relevance_score: number }> } }): number {
    if (research.evidence.records.length === 0) return 0;
    return (
      research.evidence.records.reduce((sum, record) => sum + record.relevance_score, 0) /
      research.evidence.records.length
    );
  }

  private userDataDensity(input: GoalInput): number {
    const fields = [input.goal, input.metric, input.context, input.why, ...input.other_active_goals];
    const populated = fields.filter((field) => field.trim().length > 0).length;
    return Math.min(1, populated / 6);
  }

  private toEscalation(error: unknown, goalInput: unknown): Escalation {
    const now = new Date().toISOString();
    const goalId =
      goalInput && typeof goalInput === "object" && "goal_id" in goalInput && typeof goalInput.goal_id === "string"
        ? goalInput.goal_id
        : randomUUID();

    return {
      id: randomUUID(),
      goal_id: goalId,
      trigger: error instanceof GateError ? "SYSTEM_ANOMALY" : "SYSTEM_ANOMALY",
      triggered_at: now,
      description: error instanceof Error ? error.message : String(error),
      resolved: false,
    };
  }
}
