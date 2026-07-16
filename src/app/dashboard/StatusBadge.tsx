// Soft, color-coded status indicator -- a small dot + label rather than a
// flat text pill, so status reads at a glance across dense tables.
export default function StatusBadge({ status }: { status: string }) {
  const isConfirmed = status === "confirmed";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: isConfirmed ? "rgb(34 197 94 / 0.1)" : "rgb(245 158 11 / 0.12)",
        color: isConfirmed ? "rgb(21 128 61)" : "rgb(180 83 9)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: isConfirmed ? "rgb(34 197 94)" : "rgb(245 158 11)" }}
      />
      {status}
    </span>
  );
}
