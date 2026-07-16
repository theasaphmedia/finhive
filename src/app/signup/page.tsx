"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_TEMPLATES, BLANK_TEMPLATE_ID } from "@/lib/categoryTemplates";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/onboardingOptions";

type Step = "org" | "template" | "submitting";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checkingSession, setCheckingSession] = useState(true);
  const [step, setStep] = useState<Step>("org");
  const [error, setError] = useState("");

  const [orgName, setOrgName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [templateId, setTemplateId] = useState<string>(CATEGORY_TEMPLATES[0].id);

  // /signup requires an authenticated user (they arrive here right after the
  // magic-link callback, before they have an org/profile yet).
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
      } else {
        setCheckingSession(false);
        if (!ownerName && user.email) setOwnerName(user.email.split("@")[0]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateOrg() {
    setStep("submitting");
    setError("");

    const { data: orgId, error: rpcError } = await supabase.rpc(
      "create_organization_with_owner",
      {
        org_name: orgName,
        org_currency: currency,
        org_timezone: timezone,
        owner_name: ownerName,
      }
    );

    if (rpcError || !orgId) {
      setError(rpcError?.message ?? "Could not create organization.");
      setStep("template");
      return;
    }

    if (templateId !== BLANK_TEMPLATE_ID) {
      const template = CATEGORY_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        const rows = template.categories.map((c, index) => ({
          organization_id: orgId,
          name: c.name,
          type: c.type,
          sort_order: index,
        }));
        const { error: catError } = await supabase.from("categories").insert(rows);
        if (catError) {
          // Organization already exists at this point -- surface the issue but
          // still let the owner into the dashboard to fix categories manually.
          setError(`Organization created, but starter categories failed: ${catError.message}`);
        }
      }
    }

    router.push("/dashboard");
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-xl rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-[#0F2A3D]">Set up your organization</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every organization on FinHive gets its own isolated dashboard, categories, and people.
        </p>

        {step === "org" && (
          <div className="mt-6 flex flex-col gap-4">
            <Field label="Organization name">
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. TWN Studios"
                className="input"
              />
            </Field>
            <Field label="Your name">
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Solomon Stephen"
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Currency">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="input"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Timezone">
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="input"
                >
                  {TIMEZONE_OPTIONS.map((t) => (
                    <option key={t.tz} value={t.tz}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button
              disabled={!orgName || !ownerName}
              onClick={() => setStep("template")}
              className="btn-primary mt-2"
            >
              Continue
            </button>
          </div>
        )}

        {(step === "template" || step === "submitting") && (
          <div className="mt-6 flex flex-col gap-4">
            <p className="text-sm font-medium text-zinc-700">
              Choose a starter category set (fully editable later, or start blank):
            </p>
            <div className="flex flex-col gap-2">
              {CATEGORY_TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className={`flex cursor-pointer flex-col rounded-md border p-3 text-sm transition ${
                    templateId === t.id
                      ? "border-[#1E9E6B] bg-[#1E9E6B]/5"
                      : "border-zinc-200"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-zinc-800">
                    <input
                      type="radio"
                      name="template"
                      checked={templateId === t.id}
                      onChange={() => setTemplateId(t.id)}
                    />
                    {t.label}
                  </span>
                  <span className="mt-1 pl-6 text-xs text-zinc-500">{t.description}</span>
                </label>
              ))}
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm font-medium text-zinc-800 transition ${
                  templateId === BLANK_TEMPLATE_ID
                    ? "border-[#1E9E6B] bg-[#1E9E6B]/5"
                    : "border-zinc-200"
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  checked={templateId === BLANK_TEMPLATE_ID}
                  onChange={() => setTemplateId(BLANK_TEMPLATE_ID)}
                />
                Start blank -- I'll add my own categories
              </label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="mt-2 flex gap-3">
              <button onClick={() => setStep("org")} className="btn-secondary">
                Back
              </button>
              <button
                onClick={handleCreateOrg}
                disabled={step === "submitting"}
                className="btn-primary flex-1"
              >
                {step === "submitting" ? "Creating organization..." : "Create organization"}
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-zinc-400">
        By creating an organization you agree to FinHive&apos;s{" "}
        <a href="/terms" className="hover:text-zinc-600">Terms</a>
        {" "}and{" "}
        <a href="/privacy" className="hover:text-zinc-600">Privacy Policy</a>.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
      {label}
      {children}
    </label>
  );
}
