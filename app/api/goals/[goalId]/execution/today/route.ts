import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/supabase";
import { jsonError } from "../../../../_lib/responses";

const ParamsSchema = z.object({ goalId: z.string().uuid() });

const ActionStateSchema = z.object({
  did_it: z.boolean(),
  done_right: z.boolean(),
});

const PostBodySchema = z.object({
  action_states: z.record(z.string(), ActionStateSchema),
  output_value: z.number().nullable().optional(),
  best_action: z.string().nullable().optional(),
  improvement: z.string().nullable().optional(),
  approach_change: z.string().nullable().optional(),
});

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: { goalId: string } },
) {
  try {
    const { goalId } = ParamsSchema.parse(context.params);
    const today = todayKey();
    const db = createServiceClient();
    const { data, error } = await db
      .from("execution_events")
      .select("*")
      .eq("goal_id", goalId)
      .gte("date", `${today}T00:00:00Z`)
      .lte("date", `${today}T23:59:59Z`)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`today fetch failed: ${error.message}`);
    return NextResponse.json({ ok: true, event: data ?? null, date: today });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: { goalId: string } },
) {
  try {
    const { goalId } = ParamsSchema.parse(context.params);
    const body = PostBodySchema.parse(await request.json());
    const todayMidnight = `${todayKey()}T00:00:00.000Z`;

    const stateValues = Object.values(body.action_states);
    const actionsCompleted = stateValues.filter((s) => s.did_it).length;
    const actionsTotal = stateValues.length;

    const db = createServiceClient();
    const { data, error } = await db
      .from("execution_events")
      .upsert(
        {
          goal_id: goalId,
          date: todayMidnight,
          actions_completed: actionsCompleted,
          actions_total: actionsTotal,
          output_value: body.output_value ?? null,
          best_action: body.best_action ?? null,
          improvement: body.improvement ?? null,
          approach_change: body.approach_change ?? null,
          action_states: body.action_states,
        },
        { onConflict: "goal_id,date" },
      )
      .select()
      .single();

    if (error) throw new Error(`today upsert failed: ${error.message}`);
    return NextResponse.json({ ok: true, event: data });
  } catch (error) {
    return jsonError(error);
  }
}
