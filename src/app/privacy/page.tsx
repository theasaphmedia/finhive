import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — FinHive",
};

// Draft Privacy Policy, informed by NDPA research (see
// NDPA_COMPLIANCE_CHECKLIST.md at the project root) but explicitly NOT a
// substitute for a Nigerian data-protection lawyer's review -- caveated as
// such both here and in that checklist, per CLAUDE.md's own Open Items.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f8] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm font-medium text-[#1E9E6B] hover:text-[#1E9E6B]/80">
          &larr; Back to FinHive
        </Link>

        <div className="fade-in mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Draft, not final.</strong> This is a working draft prepared while FinHive is
          piloting with a single organization, informed by research into Nigeria&apos;s Data
          Protection Act (NDPA) but not yet reviewed by a lawyer. Treat it as a starting point,
          not a finished legal document.
        </div>

        <div className="fade-in mt-6 rounded-xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0F2A3D]">Privacy Policy</h1>
          <p className="mt-1 text-sm text-zinc-500">Last updated: July 16, 2026</p>

          <div className="mt-8 flex flex-col gap-7 text-sm leading-relaxed text-zinc-700">
            <section>
              <h2 className="text-base font-semibold text-zinc-900">1. Who this covers</h2>
              <p className="mt-2">
                This policy covers personal data processed by FinHive (operated by TAI Digital)
                on behalf of the organizations that use it -- for example TWN Studios, FinHive&apos;s
                pilot organization. If you&apos;re a staff member, stakeholder, or client of one of
                those organizations, this explains what data about you FinHive holds and why.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">2. What we collect</h2>
              <p className="mt-2">FinHive processes, per organization:</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Account information for people with access: name, email address, and role.</li>
                <li>
                  Transaction data: bank alert text forwarded by the organization, and the date,
                  time, amount, description, and balance extracted from it.
                </li>
                <li>
                  Client records the organization chooses to enter: a client&apos;s name, the
                  purpose of the engagement, and fees agreed/paid.
                </li>
                <li>
                  Category and configuration data the organization sets up itself (category
                  names, budgets, branding, currency, timezone).
                </li>
                <li>
                  A hash-chained audit log of who confirmed, approved, or changed what, and when.
                </li>
              </ul>
              <p className="mt-2">
                We don&apos;t collect more than an organization puts in or generates by using the
                product -- there&apos;s no separate tracking, advertising, or analytics profile
                built about individuals.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">3. How it&apos;s used</h2>
              <p className="mt-2">
                Bank alert text is sent to Anthropic&apos;s API to extract structured transaction
                details and suggest a category from the organization&apos;s own category list.
                Anthropic processes this text to return a result to FinHive; it is not used to
                train Anthropic&apos;s models under Anthropic&apos;s API terms. All data (accounts,
                transactions, categories, clients, audit log) is stored in Supabase (Postgres),
                access-controlled at the database level so one organization&apos;s data is never
                visible to another organization or to a person outside it.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">4. Who can see what</h2>
              <p className="mt-2">
                Access within an organization follows the role its Owner or Admin assigns: Owner
                and Admin see everything for their organization; a full-access Stakeholder sees
                transaction detail; a summary-access Stakeholder sees category totals only, no
                names or memos; a Client sees only their own client record (fees agreed, paid,
                and balance), nothing else. We (TAI Digital) can access data as needed to operate,
                secure, and support the platform, and don&apos;t sell or share it with anyone
                outside that.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">5. Where it&apos;s processed</h2>
              <p className="mt-2">
                FinHive&apos;s infrastructure (Supabase, Anthropic&apos;s API, Vercel hosting) is not
                hosted in Nigeria. If you&apos;re in Nigeria, this means your personal data is
                transferred outside the country to deliver the service -- the NDPA has specific
                rules about cross-border transfers that we intend to get formal legal review on
                before onboarding organizations beyond the current pilot. See
                NDPA_COMPLIANCE_CHECKLIST.md for where this stands.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">6. How long we keep it</h2>
              <p className="mt-2">
                Each organization can set how long to keep its transaction and audit history --
                indefinitely by default, or for a fixed period (12, 24, 36, or 60 months) -- from
                its own Settings page under &quot;Data &amp; privacy.&quot; Today this is a stated
                policy the organization sets, not yet an automatic deletion job: FinHive doesn&apos;t
                purge records on a schedule by itself yet. If an organization stops using FinHive
                and wants its data deleted, contact us (Section 9).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">7. Your rights</h2>
              <p className="mt-2">
                From <strong>My account</strong> (available to anyone signed in, regardless of
                role), you can download a copy of the personal data FinHive holds about you --
                your profile, your client record if you have one, and your own action history --
                or deactivate your own account, which ends your access immediately. Deactivating
                keeps your name attached to any transactions you confirmed or approved in the
                past rather than deleting it outright, the same way a bank keeps records of who
                authorized a payment -- this preserves the audit trail Section 2 describes rather
                than creating a gap in it. If you want your organization&apos;s own copy of your
                data corrected or fully removed beyond that, contact your organization&apos;s
                Owner/Admin or contact us directly (Section 9).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">8. If something goes wrong</h2>
              <p className="mt-2">
                FinHive keeps an internal error log and a tamper-evident audit trail to help
                detect problems. If a data breach affecting personal data occurs, we follow a
                documented response procedure: contain the cause, scope which organization(s)
                and data were affected, notify Nigeria&apos;s Data Protection Commission within the
                72-hour window the NDPA requires, and notify affected organizations directly. See
                NDPA_COMPLIANCE_CHECKLIST.md, Section 6, for the full procedure -- it is a working
                draft, not yet reviewed by a lawyer.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">9. Contact</h2>
              <p className="mt-2">
                Questions, data requests, or concerns about this policy: Solomon Stephen, TAI
                Digital —{" "}
                <a href="mailto:theasaphmedia@gmail.com" className="font-medium text-[#1E9E6B] hover:text-[#1E9E6B]/80">
                  theasaphmedia@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
