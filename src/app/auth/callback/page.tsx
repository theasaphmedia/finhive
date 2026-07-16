"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Two rounds of fixes here still didn't work for an admin-issued invite
// clicked on a *different* device than the one that sent it -- both the PKCE
// `?code=` exchange and the implicit `#access_token=` hash rely on Supabase's
// own hosted /verify endpoint successfully handing a working session back to
// whatever browser clicks the link, and neither reliably survives that
// handoff across devices in practice (GoTrue's own session gets created
// server-side either way, which is why last_sign_in_at kept looking fine
// while the browser here never actually ended up with one).
//
// The robust, documented way to build a custom invite/magic-link flow that
// doesn't depend on that handoff at all: the email template links straight to
// this page with `?token_hash=...&type=...` (raw values Supabase always
// exposes to templates, unrelated to PKCE or the hash flow), and THIS PAGE
// verifies them directly via supabase.auth.verifyOtp(). That call runs here,
// in the recipient's own browser, so there's no cross-device handoff left to
// break. See supabase-invite-email-template.html for the matching template
// change (token_hash link instead of {{ .ConfirmationURL }}). Confirmed
// working end-to-end 2026-07-07 (two test accounts: profile created,
// invite accepted_at set, last_sign_in_at populated).
//
// The old `?code=` path is kept as a fallback for anything still using
// Supabase's default confirmation URL (there isn't one at the moment, but
// it's a harmless no-op if `token_hash` is present, and costs nothing to keep
// around in case a template reverts to the default).
export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "error">("working");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const code = params.get("code");

      try {
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "invite" | "magiclink" | "signup" | "recovery" | "email_change",
          });
          if (error) {
            if (!cancelled) setStatus("error");
            return;
          }
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (!cancelled) setStatus("error");
            return;
          }
        } else {
          if (!cancelled) setStatus("error");
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) setStatus("error");
          return;
        }

        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (existingProfile) {
          router.replace("/dashboard");
          return;
        }

        const { data: joinedOrgId } = await supabase.rpc("accept_invite");
        router.replace(joinedOrgId ? "/dashboard" : "/signup");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F2A3D] px-4">
      <div className="fade-in w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-lg">
        <h1 className="text-2xl font-semibold text-[#0F2A3D]">FinHive</h1>
        {status === "working" ? (
          <p className="mt-3 text-sm text-zinc-500">Signing you in...</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-zinc-600">
              This link is invalid or has expired.
            </p>
            <a
              href="/login"
              className="mt-4 inline-block font-medium text-[#1E9E6B] transition-colors hover:text-[#1E9E6B]/80"
            >
              Back to sign in
            </a>
          </>
        )}
      </div>
    </div>
  );
}
