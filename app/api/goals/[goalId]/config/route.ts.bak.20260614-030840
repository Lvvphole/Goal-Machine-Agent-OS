import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/supabase";
import { jsonError } from "../../../_lib/responses";

const ParamsSchema = z.object({ goalId: z.string().uuid() });

export const dynamic = "force-dynamic";

// Returns the latest config_versions row for the goal (the LLM-generated plan).
export async function GET(
  _request: Request,
  context: { params: { goalId: string } },
) {
  try {
    const { goalId } = ParamsSchema.parse(context.params);
    const db = createServiceClient();
    const { data, error } = await db
      .from("config_versions")
      .select("id, version_number, config, rationale, created_at")
      .eq("goal_id", goalId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`config fetch failed: ${error.message}`);
    return NextResponse.json({
      ok: true,
      version: data,
      config: data?.config ?? null,
    });
  } catch (error) {
    return jsonError(error);
  }
}
