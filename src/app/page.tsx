import Link from "next/link";

const features = [
  {
    title: "Bank-agnostic ingestion",
    body: "Forward alerts from any bank, any format -- FinHive extracts and categorizes automatically.",
  },
  {
    title: "Categories that bend to you",
    body: "Fully editable per organization. Nothing is hardcoded; rename, reorder, or add without limits.",
  },
  {
    title: "Built for every organization",
    body: "Multi-currency, timezone-aware, role-based access, and full audit trails from day one.",
  },
];

export default function Home() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center text-white"
      style={{ background: "linear-gradient(160deg, #0F2A3D 0%, #123145 55%, #0B2230 100%)" }}
    >
      <span className="fade-in rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-white/70">
        Multi-tenant finance tracking, for any organization
      </span>

      <h1 className="fade-in mt-6 text-5xl font-semibold tracking-tight">FinHive</h1>

      <p className="fade-in mt-4 max-w-lg text-base leading-relaxed text-white/70">
        Bank alerts in, categorized reports out. Churches, studios, ministries, and small
        businesses each get their own isolated dashboard, stakeholders, and clients --
        no organization&apos;s data ever touches another&apos;s.
      </p>

      <div className="fade-in mt-9 flex gap-4">
        <Link
          href="/login"
          className="rounded-md border border-white/30 px-5 py-2.5 text-sm font-medium transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/10"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-md bg-[#1E9E6B] px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#1E9E6B]/90"
        >
          Set up your organization
        </Link>
      </div>

      <div className="fade-in mt-20 grid max-w-3xl gap-6 text-left sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-lg border border-white/10 bg-white/5 p-5 transition-colors duration-150 hover:bg-white/[0.08]">
            <p className="text-sm font-semibold text-white">{f.title}</p>
            <p className="mt-2 text-xs leading-relaxed text-white/60">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
