import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

export async function GET() {
  try {
    const { error } = await supabase
      .from("_health_check")
      .select("*")
      .limit(1);

    return NextResponse.json({
      status: "connected",
      error: error?.message ?? null
    });
  } catch (err) {
    return NextResponse.json({
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error"
    });
  }
}
