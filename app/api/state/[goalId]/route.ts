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

    // Confidence is fetched as a full ConfidenceScore row from confidence_scores
    // (latest by computed_at). Returns null if no row exists. The UI panel
    // expects { components, overall, label, computed_at } and crashes if a
    // bare number is returned, so the join goes to confidence_scores, not goals.
    const [state, versions, confidenceRow] = await Promise.all([
      new GoalStateMachine().getState(goalId),
      new ConfigVersionStore().history(goalId),
      db
        .from("confidence_scores")
        .select("components, overall, label, computed_at")
        .eq("goal_id", goalId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const currentVersion = versions.at(-1) ?? null;

    return NextResponse.json({
      ok: true,
      state: state.current_state,
      current_state: state.current_state, // alias for components that expect this name
      config_version: currentVersion?.version_number ?? null,
      confidence: confidenceRow.data ?? null,
      transition_history: state.history,
      history: state.history, // alias for components that expect this name
    });
  } catch (error) {
    return jsonError(error);
  }
}
