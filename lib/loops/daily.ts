import { randomUUID } from "crypto";
import { z } from "zod";
import { ModelRouter } from "@/lib/harness/model-router";
import {
  CorrectionResponseSchema,
  GoalMachineConfig,
  GoalMachineConfigSchema,
} from "@/lib/schemas";
import { GoalStateMachine } from "@/lib/state/machine";
import { ConfigVersionStore, VersionRecord } from "@/lib/state/version-store";
import { ConvergenceDetector, ConvergencePhase, CorrectionValidationResult } from "./convergence";

export const DailyLogSchema = z.object({
  date: z.string(),
  actions_completed: z.number().int().nonnegative().optional(),
  actions_total: z.number().int().positive().optional(),
  actual_pace: z.number().nonnegative().optional(),
  required_pace: z.number().positive().optional(),
  output_value: z.number().optional(),
  notes: z.string().optional(),
});

export type DailyLog = z.infer<typeof DailyLogSchema>;
type CorrectionResponse = z.infer<typeof CorrectionResponseSchema>;

export type DailyLoopResult = {
  goalId: string;
  requiredPace: number;
  actualPace: number;
  gap: number;
  gapPercentage: number;
  phase: ConvergencePhase;
  validation: CorrectionValidationResult;
  correction: CorrectionResponse;
  version: VersionRecord;
  transitions: Array<"active" | "correcting">;
};

export class DailyLoop {
  constructor(
    private readonly versionStore = new ConfigVersionStore(),
    private readonly stateMachine = new GoalStateMachine(),
    private readonly router = new ModelRouter(),
  ) {}

  async run(goalId: string, dailyLog: unknown): Promise<DailyLoopResult> {
    const log = DailyLogSchema.parse(dailyLog);
    const history = await this.versionStore.history(goalId);
    const latestVersion = history.at(-1);
    if (!latestVersion) throw new Error(`No config version found for ${goalId}`);

    const { requiredPace, actualPace } = this.computePace(log, latestVersion.config);
    const gap = Math.max(0, requiredPace - actualPace);
    const gapPercentage = requiredPace === 0 ? 0 : (gap / requiredPace) * 100;
    const phase = ConvergenceDetector.detectPhase(gapPercentage);

    await this.stateMachine.transition(goalId, "correcting", "daily loop correction started");

    const rawCorrection = await this.router.call(
      "generator",
      this.correctionPrompt(goalId, latestVersion.config, log, {
        requiredPace,
        actualPace,
        gap,
        gapPercentage,
        phase,
      }),
      CorrectionResponseSchema,
      2500,
      0.0,
    );

    const correction = this.enforceLearningRate(rawCorrection, latestVersion.config, phase, gap);
    const validation = ConvergenceDetector.validateCorrectionSize(correction, phase);
    const version = await this.versionStore.create(
      correction.updated_config,
      `daily loop correction: ${gapPercentage.toFixed(1)}% gap (${phase})`,
      latestVersion.id,
    );

    await this.stateMachine.transition(goalId, "active", "daily loop correction completed");

    return {
      goalId,
      requiredPace,
      actualPace,
      gap,
      gapPercentage,
      phase,
      validation,
      correction: { ...correction, updated_config: version.config },
      version,
      transitions: ["active", "correcting", "active"],
    };
  }

  private computePace(log: DailyLog, config: GoalMachineConfig) {
    const requiredPace = log.required_pace ?? log.actions_total ?? config.actions.length;
    const actualPace = log.actual_pace ?? log.actions_completed ?? 0;
    return { requiredPace, actualPace };
  }

  private correctionPrompt(
    goalId: string,
    currentConfig: GoalMachineConfig,
    dailyLog: DailyLog,
    pace: {
      requiredPace: number;
      actualPace: number;
      gap: number;
      gapPercentage: number;
      phase: ConvergencePhase;
    },
  ) {
    return [
      {
        role: "system" as const,
        content: [
          "You are Model C/generator for Goal Machine daily correction.",
          "Return a CorrectionResponse only.",
          "Size the correction to the convergence phase.",
          "Use at most one new structural action and no structural action in late phase.",
        ].join(" "),
      },
      {
        role: "user" as const,
        content: JSON.stringify({
          request_id: randomUUID(),
          goal_id: goalId,
          current_config: currentConfig,
          daily_log: dailyLog,
          pace,
        }),
      },
    ];
  }

  private enforceLearningRate(
    correction: CorrectionResponse,
    currentConfig: GoalMachineConfig,
    phase: ConvergencePhase,
    gap: number,
  ): CorrectionResponse {
    const originalActionIds = new Set(currentConfig.actions.map((action) => action.id));
    const structuralAllowed = ConvergenceDetector.allowedCorrectionType(phase).includes("structural");
    const allowedNewActions = structuralAllowed ? correction.new_actions.slice(0, 1) : [];
    const allowedNewActionIds = new Set(allowedNewActions.map((action) => action.id));

    let updatedConfig: GoalMachineConfig = {
      ...correction.updated_config,
      actions: correction.updated_config.actions.filter(
        (action) => originalActionIds.has(action.id) || allowedNewActionIds.has(action.id),
      ),
    };

    for (const action of allowedNewActions) {
      if (!updatedConfig.actions.some((candidate) => candidate.id === action.id)) {
        updatedConfig = { ...updatedConfig, actions: [...updatedConfig.actions, action] };
      }
    }

    if (gap > 0 && JSON.stringify(updatedConfig) === JSON.stringify(currentConfig)) {
      updatedConfig = {
        ...updatedConfig,
        friction_score: {
          ...updatedConfig.friction_score,
          recommendations: [
            ...updatedConfig.friction_score.recommendations,
            `Daily loop minimum correction applied at ${new Date().toISOString()}`,
          ],
        },
      };
    }

    return {
      ...correction,
      new_actions: allowedNewActions,
      updated_config: GoalMachineConfigSchema.parse(updatedConfig),
    };
  }
}
