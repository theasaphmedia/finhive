import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewerContext, canManageOrg } from "@/lib/getViewerContext";
import { lineDelay } from "@/lib/lineDelay";

// Owner/admin-only view over error_log -- the substitute for a third-party
// monitoring dashboard (Sentry, etc.) that this project doesn't have an
// account for. Every unhandled API route error (via withErrorLogging in
// errorLog.ts) and every client-side render error (via ErrorBoundary.tsx /
// global-error.tsx posting to /api/log-error) lands here instead of only
// existing in Vercel's function logs, which nobody checks day to day.
export default async function ErrorsPage() {
  const { profile, organization } = await requireViewerContext();
  if (!canManageOrg(profile)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: errors } = await supabase
    .from("error_log")
    .select("id, source, message, stack, created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = errors ?? [];

  return (
    <div className="fade-in flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-800">Error log</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Unexpected errors from this organization&apos;s use of FinHive, most recent first
          (last 200). Nothing here is expected -- if a message doesn&apos;t make sense on its
          own, the stack trace underneath it has the detail.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card card-flat px-6 py-10 text-center text-sm text-zinc-500">
          No errors logged yet. That&apos;s a good sign.
        </div>
      ) : (
        <div className="card card-flat flex flex-col gap-1 p-2">
          {rows.map((e, i) => (
            <div
              key={e.id}
              className="line-in row-hover flex flex-col gap-1.5 rounded-md border-b border-zinc-100 px-4 py-3 text-[13px] last:border-0"
              style={{ animationDelay: lineDelay(i) }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="badge-accent">{e.source}</span>
                <span className="text-xs text-zinc-400">
                  {new Date(e.created_at).toLocaleString("en-US", {
                    timeZone: organization.timezone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <p className="break-words text-zinc-700">{e.message}</p>
              {e.stack && (
                <details>
                  <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600">
                    Stack trace
                  </summary>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-zinc-50 p-2 text-[11px] text-zinc-600">
                    {e.stack}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
