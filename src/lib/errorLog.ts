import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Lightweight in-app error logging -- FinHive has no Sentry/third-party
// monitoring account, so this is the substitute: every unhandled error in an
// API route (and, via ErrorBoundary.tsx, every render error in the
// dashboard) gets written to the error_log table instead of just vanishing
// into Vercel's function logs, which nobody looks at day to day.
//
// Always uses the service-role client, same convention as appendAuditEvent
// in auditLog.ts -- an error can happen before any RLS-scoped session exists
// (a bad ingestion token, a failed sign-in), so this can't depend on the
// request's own auth context to be allowed to write.
export async function logError(params: {
  source: string;
  error: unknown;
  organizationId?: string | null;
  actorProfileId?: string | null;
  context?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    const message = params.error instanceof Error ? params.error.message : String(params.error);
    const stack = params.error instanceof Error ? (params.error.stack ?? null) : null;

    await admin.from("error_log").insert({
      organization_id: params.organizationId ?? null,
      source: params.source,
      message: message.slice(0, 2000),
      stack: stack ? stack.slice(0, 8000) : null,
      context: params.context ?? {},
      actor_profile_id: params.actorProfileId ?? null,
    });
  } catch (loggingError) {
    // Never let logging itself take down the request -- if even this fails
    // (e.g. env vars missing), fall back to console so it's still visible
    // somewhere (Vercel function logs), instead of swallowing both errors.
    console.error("[logError] failed to write error_log row:", loggingError);
    console.error("[logError] original error:", params.error);
  }
}

// Wraps an API route handler so any error that escapes it (anything not
// already caught and turned into a response by the handler itself) gets
// logged and turned into a generic 500 instead of an unhandled exception.
// Route-specific validation errors (bad input, permission checks) should
// keep returning their own NextResponse as before -- this only catches what
// would otherwise be an uncaught throw.
export function withErrorLogging(
  source: string,
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      await logError({ source, error });
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}
