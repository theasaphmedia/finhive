"use client";

import { useEffect } from "react";

// Next.js App Router convention: the last-resort catch for an error thrown
// in the root layout itself (outside any segment error.tsx, e.g. on
// /login or /signup before the dashboard shell even mounts). Must render its
// own <html>/<body> since it fully replaces the root layout when active --
// plain inline styles only, since Tailwind's layer setup lives in the layout
// this file is standing in for.
export default function GlobalError({
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
        source: "root",
        message: error.message,
        stack: error.stack,
        context: { digest: error.digest },
      }),
    }).catch(() => {
      // Nothing more useful to do if even the error-logging call fails.
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "18px", fontWeight: 600, color: "#18181b", margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ maxWidth: "420px", fontSize: "14px", color: "#71717a", margin: 0 }}>
            FinHive hit an unexpected error. It&apos;s been logged -- try reloading the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "8px",
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "white",
              backgroundColor: "#0F2A3D",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
