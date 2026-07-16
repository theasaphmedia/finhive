"use client";

import { useState } from "react";

interface ShareLink {
  id: string;
  scope: string;
  scope_ref_id: string | null;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// Owner/Admin only -- lets a board member or accountant get a live,
// bookmarkable link to this org's rolling category-totals report, with no
// FinHive login needed. Only rendered when canManageOrg is true; the API
// route enforces this server-side too, so it's not just a hidden button.
export default function ReportShareLinks({ initialLinks }: { initialLinks: ShareLink[] }) {
  const [links, setLinks] = useState<ShareLink[]>(initialLinks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateLink() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/share-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "category_summary", scopeRefId: null }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not generate a link.");
      return;
    }
    setLinks((prev) => [...prev, body.link as ShareLink]);
  }

  async function revokeLink(id: string) {
    setBusy(true);
    const res = await fetch("/api/share-links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(false);
    if (!res.ok) return;
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="card card-flat mt-6 p-5 print:hidden">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Share this report</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            A public, no-login link showing category totals for the last 30 days -- for a board member, treasurer,
            or accountant. Updates automatically, never shows individual transaction memos.
          </p>
        </div>
        <button onClick={generateLink} disabled={busy} className="btn-secondary shrink-0">
          Generate link
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {links.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-2">
              <input
                readOnly
                value={typeof window !== "undefined" ? `${window.location.origin}/share/${l.token}` : ""}
                onFocus={(e) => e.target.select()}
                className="input flex-1 text-xs"
              />
              <button onClick={() => revokeLink(l.id)} disabled={busy} className="btn-secondary shrink-0 text-xs">
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
