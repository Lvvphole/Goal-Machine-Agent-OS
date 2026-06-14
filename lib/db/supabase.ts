import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "missing-anon-key";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  "missing-service-role-key";

/** Bypasses RLS. Use ONLY for harness internals and post-auth admin operations. */
export function createServiceClient() {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function cookieAdapter() {
  const store = cookies();
  return {
    getAll() { return store.getAll(); },
    setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          store.set(name, value, options as any),
        );
      } catch {
        // read-only contexts (some server components) — silently no-op
      }
    },
  };
}

/** Authenticated client for Route Handlers (app/api/**). */
export function createRouteHandlerClient() {
  return createServerClient(url, anonKey, { cookies: cookieAdapter() });
}

/** Authenticated client for Server Components. */
export function createServerComponentClient() {
  return createServerClient(url, anonKey, { cookies: cookieAdapter() });
}

/** Legacy singleton service-role client used by health probe + corpus store.
 * New code should call createServiceClient() instead. */
export const supabase = createServiceClient();
