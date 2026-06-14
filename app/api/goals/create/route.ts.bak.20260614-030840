import { NextResponse } from "next/server";
import { GoalMachineHarness } from "@/lib/harness/pipeline";
import { createServiceClient } from "@/lib/db/supabase";
import { GoalInputSchema, GoalMachineConfigSchema } from "@/lib/schemas";
import { jsonError } from "../../_lib/responses";

export async function POST(request: Request) {
  try {
    const input = GoalInputSchema.parse(await request.json());
    const result = await new GoalMachineHarness().run(input);
    const parsedConfig = GoalMachineConfigSchema.safeParse(result);

    if (!parsedConfig.success) {
      return NextResponse.json({ ok: false, escalation: result }, { status: 202 });
    }

    const db = createServiceClient();

    // Persist user-provided flat fields onto goals so the row is retrievable
    // by name/metric/deadline. The seeding trigger only writes goals(id);
    // flat fields must be written here because the harness never sees the
    // original GoalInput.
    const { error: upsertError } = await db
      .from("goals")
      .upsert(
        {
          id: parsedConfig.data.goal_id,
          goal: input.goal,
          metric: input.metric,
          target_value: input.target_value,
          current_value: input.current_value,
          deadline: input.deadline,
          current_state: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (upsertError) {
      return NextResponse.json(
        { ok: false, error: `goals upsert failed: ${upsertError.message}` },
        { status: 500 },
      );
    }

    const [confidenceResult, evidenceResult, costResult] = await Promise.all([
      db
        .from("goals")
        .select("confidence")
        .eq("id", parsedConfig.data.goal_id)
        .maybeSingle(),
      db
        .from("action_provenance")
        .select("supporting_evidence, primary_evidence_id")
        .eq("goal_id", parsedConfig.data.goal_id),
      db
        .from("agent_runs")
        .select("cost_usd")
        .eq("goal_id", parsedConfig.data.goal_id),
    ]);

    const cost = (costResult.data ?? []).reduce(
      (sum, row) => sum + (typeof row.cost_usd === "number" ? row.cost_usd : 0),
      0,
    );

    return NextResponse.json({
      ok: true,
      config: parsedConfig.data,
      confidence: confidenceResult.data?.confidence ?? null,
      sources: evidenceResult.data ?? [],
      cost,
    });
  } catch (error) {
    return jsonError(error);
  }
}
