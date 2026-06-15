import type { SupabaseClient } from "@supabase/supabase-js";

export type IdempotentResponse = {
  statusCode: number;
  body: unknown;
};

export async function checkIdempotency(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  route: string,
): Promise<IdempotentResponse | null> {
  const { data, error } = await supabase
    .from("idempotency_keys")
    .select("status_code, response_body")
    .eq("user_id", userId)
    .eq("key", key)
    .eq("route", route)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  return {
    statusCode: data.status_code as number,
    body: data.response_body as unknown,
  };
}

export async function storeIdempotency(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  route: string,
  statusCode: number,
  body: unknown,
): Promise<void> {
  await supabase.from("idempotency_keys").upsert(
    {
      user_id: userId,
      key,
      route,
      status_code: statusCode,
      response_body: body as object,
    },
    { onConflict: "user_id,key" },
  );
}
