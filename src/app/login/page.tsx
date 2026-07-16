"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/siteUrl";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [deactivated, setDeactivated] = useState(false);

  // Read this client-side (rather than via searchParams, which would force
  // this page out of static rendering) since it's a one-time informational
  // banner, not something that needs to survive a refresh.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("deactivated") === "1") {
      setDeactivated(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F2A3D] px-4">
      <div className="fade-in w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-[#0F2A3D]">FinHive</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Sign in with a magic link sent to your email.
        </p>

        {deactivated && (
          <p className="fade-in mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            That account has been deactivated. If this wasn&apos;t you, contact your
            organization&apos;s owner or admin.
          </p>
        )}

        {status === "sent" ? (
          <p className="fade-in mt-6 rounded-md bg-[#1E9E6B]/10 p-3 text-sm text-[#1E9E6B]">
            Check your email for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <label className="text-sm font-medium text-zinc-700" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@organization.org"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm transition-colors duration-150 focus:border-[#1E9E6B] focus:outline-none focus:ring-2 focus:ring-[#1E9E6B]/20"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="mt-2 rounded-md bg-[#0F2A3D] px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#0F2A3D]/90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {status === "sending" ? "Sending..." : "Send magic link"}
            </button>
            {status === "error" && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}
          </form>
        )}

        <p className="mt-6 text-center text-sm text-zinc-500">
          New organization?{" "}
          <a href="/signup" className="font-medium text-[#1E9E6B] transition-colors hover:text-[#1E9E6B]/80">
            Set up FinHive
          </a>
        </p>
        <p className="mt-4 text-center text-xs text-zinc-400">
          <a href="/terms" className="hover:text-zinc-600">Terms</a>
          {" "}&middot;{" "}
          <a href="/privacy" className="hover:text-zinc-600">Privacy</a>
        </p>
      </div>
    </div>
  );
}
