"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountManager({
  name,
  email,
  role,
  accessLevel,
}: {
  name: string;
  email: string;
  role: string;
  accessLevel: string | null;
}) {
  return (
    <div className="flex flex-col gap-8 fade-in">
      <div>
        <h2 className="text-base font-semibold text-zinc-800">My account</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Your own profile, and your rights over the personal data FinHive holds about you. See the{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600">
            Privacy Policy
          </a>{" "}
          for the full picture.
        </p>
      </div>

      <section className="card p-6">
        <h3 className="text-sm font-semibold text-zinc-800">Profile</h3>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">Name</dt>
            <dd className="mt-0.5 text-zinc-800">{name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">Email</dt>
            <dd className="mt-0.5 text-zinc-800">{email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">Role</dt>
            <dd className="mt-0.5 capitalize text-zinc-800">
              {role}
              {role === "stakeholder" && accessLevel ? ` · ${accessLevel} access` : ""}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-zinc-400">
          To change your name, role, or access level, ask your organization&apos;s Owner or Admin -- see People.
        </p>
      </section>

      <ExportSection />

      <DeleteSection />
    </div>
  );
}

function ExportSection() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/export", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Export failed.");

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finhive-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6">
      <h3 className="text-sm font-semibold text-zinc-800">Export your data</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Download a copy of the personal data FinHive holds about you: your profile, your client record if you
        have one, and your own action history (what you confirmed, approved, or edited, and when).
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={handleExport} disabled={busy} className="btn-secondary">
          {busy ? "Preparing..." : "Download my data (JSON)"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </section>
  );
}

function DeleteSection() {
  const router = useRouter();
  const supabase = createClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't deactivate your account.");

      await supabase.auth.signOut();
      router.push("/login?deactivated=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't deactivate your account.");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <section className="card p-6">
      <h3 className="text-sm font-semibold text-zinc-800">Delete your account</h3>
      <p className="mt-1 text-sm text-zinc-500">
        This ends your access to FinHive immediately. Your name stays attached to any transactions you
        confirmed or approved in the past -- FinHive keeps that as part of its tamper-evident audit trail
        rather than deleting it outright, the same way a bank keeps records of who authorized a payment. If
        you want your organization&apos;s own copy of your data fully removed, contact your organization&apos;s
        Owner/Admin, or email{" "}
        <a href="mailto:theasaphmedia@gmail.com" className="font-medium text-[var(--org-accent,_#1E9E6B)]">
          theasaphmedia@gmail.com
        </a>
        .
      </p>

      <div className="mt-4">
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50">
            Delete my account
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-800">
              This signs you out and ends your access right away. Continue?
            </p>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? "Working..." : "Yes, delete my account"}
            </button>
            <button onClick={() => setConfirming(false)} className="btn-secondary text-xs">
              Cancel
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
