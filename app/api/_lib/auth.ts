import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@/lib/db/supabase";

export type AuthSuccess = { user: User; supabase: SupabaseClient };
export type AuthFailure = { error: NextResponse };

export async function authenticate(): Promise<AuthSuccess | AuthFailure> {
  const supabase = createRouteHandlerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }
  return { user: data.user, supabase };
}
