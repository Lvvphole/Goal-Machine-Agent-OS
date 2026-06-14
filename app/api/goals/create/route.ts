import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { GoalMachineHarness } from "@/lib/harness/pipeline";
import { createServiceClient } from "@/lib/db/supabase";
import { GoalInputSchema, GoalMachineConfigSchema } from "@/lib/schemas";
import { jsonError } from "../../_lib/responses";
import { authenticate } from "../../_lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await authenticate();
    if ("error" in auth) return auth.error;
    const { user, supabase } = auth;

    const input = GoalInputSchema.parse(await request.json());

    // 1. Pre-insert goals row with user_id BEFORE running harness so the
    //    user owns the row before any child writes happen. RLS WITH CHECK
    //    on this INSERT enforces auth.uid() = user_id.
    const goalId = randomUUID();
    const { error: insertError } = await supabase
      .from("goals")
      .insert({
        id: goalId,
        user_id: user.id,
        goal: input.goal,
        metric: input.metric,
        target_value: input.target_value,
        current_value: input.current_value,
        deadline: input.deadline,
        current_state: "setup",
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: `goals insert failed: ${insertError.message}` },
        { status: 500 },
      );
    }

    // 2. Run harness with the API-generated goalId. Harness internals use
    //    service-role and bypass RLS; their writes target this goalId.
    const result = await new GoalMachineHarness().run(input, { goalId });
    const parsedConfig = GoalMachineConfigSchema.safeParse(result);

    if (!parsedConfig.success) {
      return NextResponse.json({ ok: false, escalation: result }, { status: 202 });
    }

    // 3. Read confidence and cost back.
    const admin = createServiceClient();
    const [confidenceResult, evidenceResult, costResult] = await Promise.all([
      supabase
        .from("goals")
        .select("confidence")
        .eq("id", goalId)
        .maybeSingle(),
      admin
        .from("action_provenance")
        .select("supporting_evidence, primary_evidence_id")
        .eq("goal_id", goalId),
      admin
        .from("agent_runs")
        .select("cost_usd")
        .eq("goal_id", goalId),
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
