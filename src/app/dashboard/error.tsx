"use client";

import { useEffect } from "react";

// Next.js App Router convention: catches any render/runtime error thrown
// while rendering the /dashboard segment (and everything under it) that
// wasn't already caught closer to its source, and shows this instead of a
// blank white screen or the default Next.js error overlay. Reports itself to
// /api/log-error so it lands in the Errors page (owner/admin can see it)
// instead of only existing in the browser console.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "dashboard",
        message: error.message,
        stack: error.stack,
        context: { digest: error.digest },
      }),
    }).catch(() => {
      // Nothing more useful to do if even the error-logging call fails.
    });
  }, [error]);

  return (
    <div className="card fade-in flex flex-col items-center gap-3 px-8 py-14 text-center">
      <h2 className="text-base font-semibold text-zinc-800">Something went wrong</h2>
      <p className="max-w-md text-sm text-zinc-500">
        This page hit an unexpected error. It&apos;s been logged -- try again, or use the
        sidebar to head somewhere else if the problem continues.
      </p>
      <button onClick={() => reset()} className="btn-primary mt-2">
        Try again
      </button>
    </div>
  );
}
