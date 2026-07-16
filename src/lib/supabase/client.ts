import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Safe to use in Client Components.
// Uses the publishable/anon key only -- RLS on every table is what actually
// keeps one organization's data isolated from another's (see CLAUDE.md Section 2).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
