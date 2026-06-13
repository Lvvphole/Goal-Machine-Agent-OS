import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/supabase";
import { GoalStateMachine } from "@/lib/state/machine";
import { ConfigVersionStore } from "@/lib/state/version-store";
import { jsonError } from "../../_lib/responses";

const ParamsSchema = z.object({
  goalId: z.string().uuid(),
});

export async function GET(
  _request: Request,
  context: { params: { goalId: string } },
) {
  try {
    const { goalId } = ParamsSchema.parse(context.params);
    const db = createServiceClient();
    const [state, versions, goal] = await Promise.all([
      new GoalStateMachine().getState(goalId),
      new ConfigVersionStore().history(goalId),
      db.from("goals").select("confidence").eq("id", goalId).maybeSingle(),
    ]);
    const currentVersion = versions.at(-1) ?? null;

    return NextResponse.json({
      ok: true,
      state: state.current_state,
      config_version: currentVersion?.version_number ?? null,
      confidence: goal.data?.confidence ?? null,
      transition_history: state.history,
    });
  } catch (error) {
    return jsonError(error);
  }
}
