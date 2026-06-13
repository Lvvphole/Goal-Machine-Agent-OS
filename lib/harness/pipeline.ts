import { randomUUID } from "crypto";
import { z } from "zod";
import { CorpusStore, type ResearchChunk } from "@/lib/corpus/store";
import { createServiceClient } from "@/lib/db/supabase";
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
import { ModelRole, ModelRouter, Settings } from "./model-router";
import { retryWithFeedback } from "./retry";

export type HarnessResult = GoalMachineConfig | Escalation;

const TEMPERATURE = 0.0;

// Approximate per-million-token pricing (USD). Adjust as model prices change.
const PRICE_PER_M_TOKENS: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5":  { in: 1.00, out: 5.00 },
  "claude-sonnet-4-6": { in: 3.00, out: 15.00 },
  "gpt-4o-mini":       { in: 0.15, out: 0.60 },
  "gpt-4o":            { in: 2.50, out: 10.00 },
};

type AgentRunLog = {
  stage: ModelRole;
  model_used: string;
  duration_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
};

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
  corpusStore?: CorpusStore;
};

export class GoalMachineHarness {
  private readonly router: ModelRouter;
  private readonly versionStore: ConfigVersionStore;
  private readonly stateMachine: GoalStateMachine;
  private readonly confidenceEngine: ConfidenceEngine;
  private readonly corpusStore: CorpusStore;
  private readonly settings = new Settings();
  private agentRuns: AgentRunLog[] = [];

  constructor(options: GoalMachineHarnessOptions = {}) {
    this.router = options.router ?? new ModelRouter();
    this.versionStore = options.versionStore ?? new ConfigVersionStore();
    this.stateMachine = options.stateMachine ?? new GoalStateMachine();
    this.confidenceEngine = options.confidenceEngine ?? new ConfidenceEngine();
    this.corpusStore = options.corpusStore ?? new CorpusStore();
  }

  async run(goalInput: unknown): Promise<HarnessResult> {
    this.agentRuns = [];
    try {
      const input = gate1Input(goalInput);

      const classificationInput = this.classificationPrompt(input);
      const classification = gate2BaseRate(
        await this.callWithRetry("classifier", classificationInput, GoalClassificationSchema, 1200),
      );

      const researchChunks = await this.corpusStore.query(this.corpusTags(classification));
      const researchInput = this.retrievalPrompt(input, classification, researchChunks);
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
        config.goal_id,
        this.evidenceQuality(research),
        Math.min(1, research.evidence.total_sources / 5),
        classification.controllable_daily_action ? 1 : 0.5,
        this.userDataDensity(input),
      );

      // Flush buffered LLM call metrics with the now-known goal_id.
      await this.flushAgentRuns(config.goal_id);

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
    const startedAt = Date.now();
    try {
      const result = await model.call(input, schema, maxTokens, TEMPERATURE);
      this.recordRun(role, startedAt, input, result);
      return result;
    } catch (error) {
      const result = await retryWithFeedback(
        model,
        input,
        schema,
        error,
        1,
        maxTokens,
        TEMPERATURE,
      );
      this.recordRun(role, startedAt, input, result);
      return result;
    }
  }

  private recordRun(
    role: ModelRole,
    startedAt: number,
    input: ModelInput,
    result: unknown,
  ): void {
    const inputStr =
      typeof input === "string"
        ? input
        : input.map((message) => message.content).join("\n");
    const promptTokens = Math.ceil(inputStr.length / 4);
    const completionTokens = Math.ceil(JSON.stringify(result ?? "").length / 4);
    const modelName = this.settings.getModelSettings(role).model;
    const price = PRICE_PER_M_TOKENS[modelName] ?? { in: 0, out: 0 };
    const costUsd =
      (promptTokens * price.in + completionTokens * price.out) / 1_000_000;

    this.agentRuns.push({
      stage: role,
      model_used: modelName,
      duration_ms: Date.now() - startedAt,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost_usd: costUsd,
    });
  }

  private async flushAgentRuns(goalId: string): Promise<void> {
    if (this.agentRuns.length === 0) return;
    const db = createServiceClient();
    const rows = this.agentRuns.map((run) => ({
      goal_id: goalId,
      model_used: run.model_used,
      prompt_tokens: run.prompt_tokens,
      completion_tokens: run.completion_tokens,
      cost_usd: run.cost_usd,
      duration_ms: run.duration_ms,
      stage: run.stage,
    }));
    const { error } = await db.from("agent_runs").insert(rows);
    if (error) {
      console.error("agent_runs flush failed:", error.message);
    }
    this.agentRuns = [];
  }

  private classificationPrompt(input: GoalInput): ModelInput {
    return [
      {
        role: "system",
        content:
          "Classify the goal for the Goal Machine harness. Use conservative base rates and cite the source name in base_rate_source.",
      },
      { role: "user", content: JSON.stringify(input) },
    ];
  }

  private corpusTags(classification: {
    recommended_corpus_tags?: string[];
    domain: string;
    goal_type: string;
  }): string[] {
    const recommendedTags =
      classification.recommended_corpus_tags?.filter((tag) => tag.trim().length > 0) ?? [];

    if (recommendedTags.length > 0) {
      return recommendedTags;
    }

    return [classification.domain, classification.goal_type].filter(
      (tag) => tag.trim().length > 0,
    );
  }

  private retrievalPrompt(
    input: GoalInput,
    classification: unknown,
    researchChunks: ResearchChunk[],
  ): ModelInput {
    return [
      {
        role: "system",
        content:
          "Retrieve and synthesize evidence for an evidence-backed plan. Prefer durable behavioral science and domain-specific evidence.",
      },
      {
        role: "user",
        content: JSON.stringify({
          goal_input: input,
          classification,
          research_chunks: researchChunks,
        }),
      },
    ];
  }

  private generationPrompt(input: GoalInput, classification: unknown, research: unknown): ModelInput {
    return [
      {
        role: "system",
        content:
          "Generate a GoalMachineConfig with concrete actions, backup plans, environment design, and validation-friendly UUIDs and ISO datetimes.",
      },
      {
        role: "user",
        content: JSON.stringify({ goal_input: input, classification, research }),
      },
    ];
  }

  private evidenceQuality(research: {
    evidence: { records: Array<{ relevance_score: number }> };
  }): number {
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
