import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? "missing-service-role-key";

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}
