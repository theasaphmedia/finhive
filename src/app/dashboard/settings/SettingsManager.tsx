"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SettingsManager({
  organizationId,
  organizationName,
  currency,
  initialPrimary,
  initialAccent,
  initialToken,
  initialApprovalThreshold,
  initialRetentionMonths,
  isOwner,
  appUrl,
}: {
  organizationId: string;
  organizationName: string;
  currency: string;
  initialPrimary: string;
  initialAccent: string;
  initialToken: string | null;
  initialApprovalThreshold: number | null;
  initialRetentionMonths: number | null;
  isOwner: boolean;
  appUrl: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-10 fade-in">
      <div>
        <h2 className="text-base font-semibold text-zinc-800">Settings</h2>
        <p className="mt-1 text-sm text-zinc-500">Organization branding and automatic ingestion setup.</p>
      </div>

      <BrandingSection
        organizationId={organizationId}
        organizationName={organizationName}
        initialPrimary={initialPrimary}
        initialAccent={initialAccent}
        supabase={supabase}
        router={router}
      />

      <GovernanceSection
        organizationId={organizationId}
        currency={currency}
        initialApprovalThreshold={initialApprovalThreshold}
        isOwner={isOwner}
        supabase={supabase}
        router={router}
      />

      <IngestionSection
        organizationId={organizationId}
        initialToken={initialToken}
        isOwner={isOwner}
        appUrl={appUrl}
        supabase={supabase}
      />

      <DataPrivacySection
        organizationId={organizationId}
        initialRetentionMonths={initialRetentionMonths}
        isOwner={isOwner}
        supabase={supabase}
        router={router}
      />

      <section>
        <h3 className="text-sm font-semibold text-zinc-800">Legal</h3>
        <p className="mt-2 text-xs text-zinc-400">
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600">
            Terms of Service
          </a>
          {" "}&middot;{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600">
            Privacy Policy
          </a>
        </p>
      </section>
    </div>
  );
}

function GovernanceSection({
  organizationId,
  currency,
  initialApprovalThreshold,
  isOwner,
  supabase,
  router,
}: {
  organizationId: string;
  currency: string;
  initialApprovalThreshold: number | null;
  isOwner: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  router: ReturnType<typeof useRouter>;
}) {
  const [enabled, setEnabled] = useState(initialApprovalThreshold !== null);
  const [threshold, setThreshold] = useState(
    initialApprovalThreshold !== null ? String(initialApprovalThreshold) : ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const value = enabled && threshold ? Number(threshold) : null;
    const { error: err } = await supabase
      .from("organizations")
      .update({ approval_threshold: value })
      .eq("id", organizationId);
    setSaving(false);
    if (err) return setError(err.message);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section className="card p-6">
      <h3 className="text-sm font-semibold text-zinc-800">Approval threshold</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Require a second, different owner or admin to approve any debit at or above this amount before it
        counts as confirmed -- the same person who categorized it can&apos;t also approve it. Leave this off
        if your organization doesn&apos;t need a second sign-off on large payments.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={!isOwner}
            className="h-4 w-4 accent-current"
            style={{ color: "var(--org-accent, #1E9E6B)" }}
          />
          Require second approval for large debits
        </label>
      </div>

      {enabled && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-zinc-500">{currency}</span>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            disabled={!isOwner}
            placeholder="e.g. 100000"
            className="input w-40"
          />
          <span className="text-sm text-zinc-500">or more needs a second approver</span>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !isOwner}
          title={!isOwner ? "Only the owner can change this" : undefined}
          className="btn-primary"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {saved && <span className="text-sm text-[var(--org-accent)]">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </section>
  );
}

function BrandingSection({
  initialPrimary,
  initialAccent,
  supabase,
  router,
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
  initialPrimary: string;
  initialAccent: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  router: ReturnType<typeof useRouter>;
}) {
  const [primary, setPrimary] = useState(initialPrimary);
  const [accent, setAccent] = useState(initialAccent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const { error: err } = await supabase
      .from("organizations")
      .update({ brand_primary_color: primary, brand_accent_color: accent })
      .eq("id", organizationId);
    setSaving(false);
    if (err) return setError(err.message);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  const presets = [
    { name: "FinHive Default", primary: "#0F2A3D", accent: "#1E9E6B" },
    { name: "Forest & Gold", primary: "#1A2E1A", accent: "#C9A84C" },
    { name: "Royal & Rose", primary: "#241B4E", accent: "#E0607E" },
    { name: "Slate & Amber", primary: "#1E293B", accent: "#D97706" },
  ];

  const initial = organizationName.trim().charAt(0).toUpperCase() || "F";

  return (
    <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_300px]">
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-zinc-800">Brand colors</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Every organization on FinHive starts with the same neutral palette and can make it their own here --
          this changes the header, buttons, and highlights across your whole dashboard.
        </p>

        <div className="mt-5 flex flex-wrap gap-6">
          <ColorField label="Primary (header, buttons)" value={primary} onChange={setPrimary} />
          <ColorField label="Accent (highlights, active states)" value={accent} onChange={setAccent} />
        </div>

        <div className="mt-5">
          <p className="text-xs font-medium text-zinc-500">Quick presets</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  setPrimary(p.primary);
                  setAccent(p.accent);
                }}
                className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <span className="flex -space-x-1">
                  <span className="h-3 w-3 rounded-full border border-white" style={{ backgroundColor: p.primary }} />
                  <span className="h-3 w-3 rounded-full border border-white" style={{ backgroundColor: p.accent }} />
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save branding"}
          </button>
          {saved && <span className="text-sm text-[var(--org-accent)]">Saved.</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      <div className="lg:sticky lg:top-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Live preview</p>
        <div className="card overflow-hidden p-0 shadow-lg transition-colors duration-200">
          <div className="flex">
            <div
              className="flex w-14 flex-col items-center gap-3 py-4 transition-colors duration-200"
              style={{ backgroundColor: primary }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white transition-colors duration-200"
                style={{ backgroundColor: accent }}
              >
                {initial}
              </span>
              <span className="h-1 w-6 rounded-full bg-white/25" />
              <span className="h-1 w-6 rounded-full bg-white/25" />
              <span className="h-1 w-6 rounded-full transition-colors duration-200" style={{ backgroundColor: accent }} />
              <span className="h-1 w-6 rounded-full bg-white/25" />
            </div>
            <div className="flex-1 bg-white p-4">
              <p className="text-xs font-semibold transition-colors duration-200" style={{ color: primary }}>
                {organizationName || "Your organization"}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Dashboard preview</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-200"
                  style={{ backgroundColor: `${accent}1A`, color: accent }}
                >
                  Confirmed
                </span>
                <span
                  className="rounded-md px-2.5 py-1 text-[10px] font-medium text-white transition-colors duration-200"
                  style={{ backgroundColor: accent }}
                >
                  Save changes
                </span>
              </div>
              <div
                className="mt-3 h-14 rounded-md transition-all duration-200"
                style={{ background: `linear-gradient(135deg, ${primary}14, ${accent}14)` }}
              />
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Updates instantly as you pick colors or presets.</p>
      </div>
    </section>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-md border border-zinc-300 p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input w-28 font-mono"
        />
      </div>
    </div>
  );
}

function IngestionSection({
  organizationId,
  initialToken,
  isOwner,
  appUrl,
  supabase,
}: {
  organizationId: string;
  initialToken: string | null;
  isOwner: boolean;
  appUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const [token, setToken] = useState(initialToken);
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const ingestUrl = appUrl ? `${appUrl}/api/ingest` : "https://YOUR-FINHIVE-DOMAIN/api/ingest";

  async function regenerate() {
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("regenerate_ingestion_token");
    setBusy(false);
    setConfirming(false);
    if (err) return setError(err.message);
    setToken(data as string);
    setRevealed(true);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="card p-6">
      <h3 className="text-sm font-semibold text-zinc-800">Automatic bank alert ingestion</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Use this token and endpoint in your organization&apos;s Google Apps Script so bank alert emails get
        imported automatically -- no manual typing required.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <Field label="Ingestion endpoint (FINHIVE_API_URL)">
          <code className="flex-1 truncate rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700">{ingestUrl}</code>
          <button onClick={() => copy(ingestUrl)} className="btn-secondary text-xs">
            Copy
          </button>
        </Field>

        <Field label="Ingestion token (FINHIVE_INGESTION_TOKEN)">
          <code className="flex-1 truncate rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
            {token ? (revealed ? token : "•".repeat(24)) : "No token yet"}
          </code>
          {token && (
            <>
              <button onClick={() => setRevealed((r) => !r)} className="btn-secondary text-xs">
                {revealed ? "Hide" : "Reveal"}
              </button>
              <button onClick={() => copy(token)} className="btn-secondary text-xs">
                Copy
              </button>
            </>
          )}
        </Field>
        {copied && <span className="text-xs text-[var(--org-accent)]">Copied.</span>}
      </div>

      <div className="mt-5">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!isOwner}
            title={!isOwner ? "Only the owner can regenerate this token" : undefined}
            className="btn-secondary"
          >
            {token ? "Regenerate token" : "Generate token"}
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">
              Regenerating breaks any Apps Script still using the old token until it&apos;s updated. Continue?
            </p>
            <button onClick={regenerate} disabled={busy} className="btn-primary text-xs">
              {busy ? "Working..." : "Yes, regenerate"}
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

function DataPrivacySection({
  organizationId,
  initialRetentionMonths,
  isOwner,
  supabase,
  router,
}: {
  organizationId: string;
  initialRetentionMonths: number | null;
  isOwner: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  router: ReturnType<typeof useRouter>;
}) {
  const [retention, setRetention] = useState(
    initialRetentionMonths === null ? "indefinite" : String(initialRetentionMonths)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const value = retention === "indefinite" ? null : Number(retention);
    const { error: err } = await supabase
      .from("organizations")
      .update({ data_retention_months: value })
      .eq("id", organizationId);
    setSaving(false);
    if (err) return setError(err.message);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section className="card p-6">
      <h3 className="text-sm font-semibold text-zinc-800">Data &amp; privacy</h3>
      <p className="mt-1 text-sm text-zinc-500">
        How long to keep transaction and audit history. See{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600">
          Privacy Policy
        </a>{" "}
        for the full policy this reflects.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-sm text-zinc-700" htmlFor="retention-select">
          Keep transaction &amp; audit history for
        </label>
        <select
          id="retention-select"
          value={retention}
          onChange={(e) => setRetention(e.target.value)}
          disabled={!isOwner}
          className="input w-44"
        >
          <option value="indefinite">Indefinitely (default)</option>
          <option value="12">12 months</option>
          <option value="24">24 months</option>
          <option value="36">36 months</option>
          <option value="60">60 months</option>
        </select>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        This is a stated policy for your organization, not yet an automatic deletion job -- changing it records
        your intended retention period; actually purging older records still happens on request today.
      </p>

      <div className="mt-4 rounded-md bg-zinc-50 px-4 py-3">
        <p className="text-sm text-zinc-700">
          <strong>Your own data.</strong> Anyone signed in to this organization&apos;s FinHive can export their
          own data or deactivate their own account from{" "}
          <a href="/dashboard/account" className="font-medium text-[var(--org-accent,_#1E9E6B)]">
            My account
          </a>
          . For anything beyond that -- like removing an organization&apos;s own copy of someone&apos;s data
          entirely -- contact this organization&apos;s Owner/Admin, or email{" "}
          <a href="mailto:theasaphmedia@gmail.com" className="font-medium text-[var(--org-accent,_#1E9E6B)]">
            theasaphmedia@gmail.com
          </a>
          .
        </p>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !isOwner}
          title={!isOwner ? "Only the owner can change this" : undefined}
          className="btn-primary"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {saved && <span className="text-sm text-[var(--org-accent)]">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      <div className="mt-1.5 flex items-center gap-2">{children}</div>
    </div>
  );
}
