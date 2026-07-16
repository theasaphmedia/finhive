import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for server-only code that must bypass RLS -- specifically
// the /api/ingest route, which is called by an org's Google Apps Script (not an
// authenticated Supabase user), so there is no user session/RLS context to run
// under. NEVER import this from a Client Component or expose the service role
// key to the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
