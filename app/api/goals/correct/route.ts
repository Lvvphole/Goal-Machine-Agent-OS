import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { callModelC } from "../../_lib/model";
import { jsonError } from "../../_lib/responses";
import { CorrectionResponseSchema, GoalMachineConfig } from "@/lib/schemas";
import { ConfigVersionStore } from "@/lib/state/version-store";
import { GoalStateMachine } from "@/lib/state/machine";

const DailyLogSchema = z.object({
  date: z.string(),
  actions_completed: z.number().int().nonnegative(),
  actions_total: z.number().int().positive(),
  output_value: z.number().optional(),
  notes: z.string().optional(),
});

const CorrectRequestSchema = z.object({
  goalId: z.string().uuid(),
  dailyLogs: z.array(DailyLogSchema),
  gapDimension: z.string().min(1),
  gapMagnitude: z.number(),
});

function convergencePhase(logCount: number, gapMagnitude: number) {
  if (logCount <= 7) return gapMagnitude > 0 ? "early_rebuild" : "early_stabilize";
  if (logCount <= 21) return "mid_adjust";
  return "late_fine_tune";
}

function limitStructuralChange(
  response: z.infer<typeof CorrectionResponseSchema>,
  currentConfig: GoalMachineConfig,
) {
  if (response.new_actions.length <= 1) return response;

  const [firstAction] = response.new_actions;
  const originalActionIds = new Set(currentConfig.actions.map((action) => action.id));
  const updatedConfig: GoalMachineConfig = {
    ...response.updated_config,
    actions: response.updated_config.actions.filter(
      (action) => originalActionIds.has(action.id) || action.id === firstAction.id,
    ),
  };

  if (!updatedConfig.actions.some((action) => action.id === firstAction.id)) {
    updatedConfig.actions = [...updatedConfig.actions, firstAction];
  }

  return {
    ...response,
    new_actions: [firstAction],
    updated_config: updatedConfig,
  };
}

export async function POST(request: Request) {
  try {
    const input = CorrectRequestSchema.parse(await request.json());
    const versionStore = new ConfigVersionStore();
    const stateMachine = new GoalStateMachine();
    const [state, history] = await Promise.all([
      stateMachine.getState(input.goalId),
      versionStore.history(input.goalId),
    ]);
    const latestVersion = history.at(-1);

    if (!latestVersion) {
      return NextResponse.json({ ok: false, error: "No config version found" }, { status: 404 });
    }

    const phase = convergencePhase(input.dailyLogs.length, input.gapMagnitude);
    const modelResponse = await callModelC(
      input.goalId,
      "correction",
      [
        {
          role: "system",
          content: [
            "You are Model C for Goal Machine correction.",
            "Return a CorrectionResponse only.",
            "Make the smallest useful correction and include no more than one new structural action.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            request_id: randomUUID(),
            goal_id: input.goalId,
            state_snapshot: state,
            current_config: latestVersion.config,
            daily_logs: input.dailyLogs,
            gap_dimension: input.gapDimension,
            gap_magnitude: input.gapMagnitude,
            convergence_phase: phase,
          }),
        },
      ],
      CorrectionResponseSchema,
      2500,
    );

    const correction = limitStructuralChange(modelResponse, latestVersion.config);
    const newVersion = await versionStore.create(
      correction.updated_config,
      `correction: ${input.gapDimension}`,
      latestVersion.id,
    );

    return NextResponse.json({
      ok: true,
      phase,
      correction: { ...correction, updated_config: newVersion.config },
      version: newVersion,
    });
  } catch (error) {
    return jsonError(error);
  }
}
