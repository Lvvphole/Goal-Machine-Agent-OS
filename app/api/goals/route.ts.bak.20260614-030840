import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/supabase";
import { jsonError } from "../_lib/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("goals")
      .select(
        "id, goal, metric, target_value, current_value, deadline, current_state, confidence, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(`goals list failed: ${error.message}`);
    return NextResponse.json({ ok: true, goals: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}
