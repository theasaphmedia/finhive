import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError, withErrorLogging } from "@/lib/errorLog";

// Receives client-side render errors from ErrorBoundary.tsx (dashboard
// segment) and global-error.tsx (root segment). Those are Client Components,
// so they can't import errorLog.ts's logError directly -- it uses the
// service-role client, which must never reach the browser bundle. This route
// is the bridge: it stays server-side, and best-effort attaches whichever
// org/profile is actually signed in (a render error can happen before or
// after auth resolves, so there may be neither).
export const POST = withErrorLogging("api:/api/log-error", async (request: Request) => {
  const body = await request.json();
  const { message, stack, source, context } = body as {
    message?: unknown;
    stack?: unknown;
    source?: unknown;
    context?: unknown;
  };

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let organizationId: string | null = null;
  let actorProfileId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("id", user.id)
      .maybeSingle();
    organizationId = profile?.organization_id ?? null;
    actorProfileId = profile?.id ?? null;
  }

  const reconstructed = new Error(message.slice(0, 2000));
  if (typeof stack === "string") reconstructed.stack = stack.slice(0, 8000);

  await logError({
    source: typeof source === "string" ? `client:${source}` : "client:unknown",
    error: reconstructed,
    organizationId,
    actorProfileId,
    context: context && typeof context === "object" ? (context as Record<string, unknown>) : {},
  });

  return NextResponse.json({ ok: true });
});
