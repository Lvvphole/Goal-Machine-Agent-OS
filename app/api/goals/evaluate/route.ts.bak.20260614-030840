import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/supabase";
import { ConfigVersionStore } from "@/lib/state/version-store";
import { jsonError } from "../../_lib/responses";

const EvaluateRequestSchema = z.object({
  goalId: z.string().uuid(),
});

type ExecutionEventRow = {
  date: string;
  actions_completed: number | null;
  actions_total: number | null;
  output_value: number | null;
};

function weeklyRates(events: ExecutionEventRow[]) {
  return [0, 1, 2].map((weekIndex) => {
    const slice = events.slice(weekIndex * 7, weekIndex * 7 + 7);
    const completed = slice.reduce((sum, event) => sum + (event.actions_completed ?? 0), 0);
    const total = slice.reduce((sum, event) => sum + (event.actions_total ?? 0), 0);
    return total === 0 ? 0 : completed / total;
  });
}

function hasFlatline(rates: number[]) {
  return rates.length === 3 && Math.max(...rates) - Math.min(...rates) <= 0.03;
}

function hasBrokenLink(events: ExecutionEventRow[]) {
  const totalActions = events.reduce((sum, event) => sum + (event.actions_total ?? 0), 0);
  const completedActions = events.reduce((sum, event) => sum + (event.actions_completed ?? 0), 0);
  const completionRate = totalActions === 0 ? 0 : completedActions / totalActions;
  const outputs = events
    .map((event) => event.output_value)
    .filter((value): value is number => typeof value === "number");
  const outputDelta = outputs.length >= 2 ? outputs[outputs.length - 1] - outputs[0] : 0;

  return completionRate >= 0.8 && Math.abs(outputDelta) < 0.01;
}

export async function POST(request: Request) {
  try {
    const input = EvaluateRequestSchema.parse(await request.json());
    const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const db = createServiceClient();
    const { data, error } = await db
      .from("execution_events")
      .select("date, actions_completed, actions_total, output_value")
      .eq("goal_id", input.goalId)
      .gte("date", since)
      .order("date", { ascending: true });

    if (error) throw new Error(`execution event lookup failed: ${error.message}`);

    const events = (data ?? []) as ExecutionEventRow[];
    const rates = weeklyRates(events);
    const flatline = hasFlatline(rates);
    const lToGBroken = hasBrokenLink(events);
    const versions = await new ConfigVersionStore().history(input.goalId);
    const currentVersion = versions.at(-1) ?? null;
    const previousVersion = versions.at(-2) ?? null;
    const changedFields = currentVersion?.diffs.map((diff) => diff.field) ?? [];
    const recommendation = flatline
      ? "rebuild"
      : lToGBroken
        ? "revise_actions"
        : previousVersion && changedFields.length > 0
          ? "continue_current_version"
          : "continue";

    return NextResponse.json({
      ok: true,
      goalId: input.goalId,
      weekly_rates: rates,
      flatline_3_week: flatline,
      l_to_g_broken: lToGBroken,
      version_comparison: {
        current_version: currentVersion?.version_number ?? null,
        previous_version: previousVersion?.version_number ?? null,
        changed_fields: changedFields,
      },
      recommendation,
    });
  } catch (error) {
    return jsonError(error);
  }
}
