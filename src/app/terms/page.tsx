import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — FinHive",
};

// Draft ToS, intentionally caveated as such (see CLAUDE.md Open Items and
// NDPA_COMPLIANCE_CHECKLIST.md at the project root). This is a real starting
// point, not filler text -- but it hasn't been reviewed by a lawyer, and
// shouldn't be treated as final before onboarding any organization beyond
// the TWN Studios pilot.
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f8] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm font-medium text-[#1E9E6B] hover:text-[#1E9E6B]/80">
          &larr; Back to FinHive
        </Link>

        <div className="fade-in mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Draft, not final.</strong> This is a working draft prepared while FinHive is
          piloting with a single organization. It has not been reviewed by a lawyer and should
          be treated as a starting point, not a finished legal document, before it&apos;s shown
          to any organization outside that pilot.
        </div>

        <div className="fade-in mt-6 rounded-xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0F2A3D]">Terms of Service</h1>
          <p className="mt-1 text-sm text-zinc-500">Last updated: July 16, 2026</p>

          <div className="mt-8 flex flex-col gap-7 text-sm leading-relaxed text-zinc-700">
            <section>
              <h2 className="text-base font-semibold text-zinc-900">1. What FinHive is</h2>
              <p className="mt-2">
                FinHive is a finance-tracking web application, built and operated by TAI Digital
                (&quot;we,&quot; &quot;us&quot;), that lets an organization (a church, studio, ministry, small
                business, or similar) automatically ingest bank transaction alerts, categorize
                them using categories the organization defines itself, and give its own people
                and clients an isolated view of that data. Each organization&apos;s data is kept
                separate from every other organization&apos;s on the platform.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">2. Accounts and roles</h2>
              <p className="mt-2">
                Access to an organization&apos;s FinHive workspace is granted by that
                organization&apos;s own Owner or Admin, who assigns each person a role (Owner,
                Admin, Stakeholder, or Client) that determines what they can see and do. You are
                responsible for keeping your sign-in access secure and for anything done under
                your account. An organization&apos;s Owner is responsible for who they invite and
                what access they grant.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">3. Bank alert ingestion</h2>
              <p className="mt-2">
                If an organization sets up automatic ingestion, it authorizes FinHive to receive
                forwarded bank alert text (via a Google Apps Script the organization controls)
                and to process that text -- including sending it to a third-party AI service
                (Anthropic) for extraction and categorization -- in order to populate its
                transaction records. An organization can stop this at any time by revoking its
                ingestion token or removing the Apps Script trigger.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">4. Accuracy and review</h2>
              <p className="mt-2">
                Automatic extraction and categorization is a best-effort process, not a
                guarantee. FinHive flags transactions it isn&apos;t confident about instead of
                forcing a guess, but an organization&apos;s own Owner, Admin, or designated
                reviewers remain responsible for reviewing flagged items and confirming that
                categorized transactions are actually correct before relying on any report for
                real decisions (board reporting, audits, tax filings, and similar).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">5. Data ownership</h2>
              <p className="mt-2">
                An organization owns the data it puts into or generates within its own FinHive
                workspace -- its transactions, categories, client records, and so on. We don&apos;t
                claim ownership of it, and we don&apos;t use one organization&apos;s data for another
                organization&apos;s benefit. See the <Link href="/privacy" className="font-medium text-[#1E9E6B] hover:text-[#1E9E6B]/80">Privacy Policy</Link> for how it&apos;s handled.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">6. Availability and no warranty</h2>
              <p className="mt-2">
                FinHive is provided as-is, during an active pilot phase, without guarantees of
                uptime, accuracy, or fitness for a particular purpose. We aim to keep it reliable
                and will fix issues as they&apos;re found, but you shouldn&apos;t treat it as your only
                or final source of financial record-keeping without your own backups or
                reconciliation.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">7. Changes</h2>
              <p className="mt-2">
                These terms may change as FinHive develops, especially as it moves beyond the
                initial pilot organization. Material changes will be reflected here with an
                updated date.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900">8. Contact</h2>
              <p className="mt-2">
                Questions about these terms: Solomon Stephen, TAI Digital —{" "}
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
