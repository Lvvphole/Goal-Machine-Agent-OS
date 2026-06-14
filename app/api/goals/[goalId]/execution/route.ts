import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/supabase";
import { jsonError } from "../../../_lib/responses";

const ParamsSchema = z.object({ goalId: z.string().uuid() });

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: { goalId: string } },
) {
  try {
    const { goalId } = ParamsSchema.parse(context.params);
    const db = createServiceClient();
    const { data, error } = await db
      .from("execution_events")
      .select("id, date, actions_completed, actions_total, output_value, best_action, improvement, approach_change, action_states, created_at")
      .eq("goal_id", goalId)
      .order("date", { ascending: false })
      .limit(90);

    if (error) throw new Error(`execution events fetch failed: ${error.message}`);
    return NextResponse.json({ ok: true, events: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}
