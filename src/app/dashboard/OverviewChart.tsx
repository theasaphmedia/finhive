// Minimalist grouped-bar visualization of income vs. expenses. Pure SVG, no
// client JS required for the chart itself -- only the range picker is a
// client component, nested in here as a child.
import RangePicker from "./RangePicker";

export interface MonthPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
}

const RANGE_SUBTITLES: Record<string, string> = {
  "1w": "Income vs. expenses, last week",
  "1m": "Income vs. expenses, last month",
  "3m": "Income vs. expenses, last 3 months",
  "6m": "Income vs. expenses, last 6 months",
  "1y": "Income vs. expenses, last year",
};

export default function OverviewChart({
  data,
  currency,
  accentColor,
  range,
}: {
  data: MonthPoint[];
  currency: string;
  accentColor: string;
  range: string;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalExpense = data.reduce((s, d) => s + d.expense, 0);
  const net = totalIncome - totalExpense;

  const width = 640;
  const height = 200;
  const paddingBottom = 24;
  const chartHeight = height - paddingBottom;
  const groupWidth = width / Math.max(data.length, 1);
  const barWidth = Math.min(22, groupWidth / 3.2);

  function fmt(n: number) {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }

  return (
    <div className="card fade-in p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-800">Cash flow</h2>
          <p className="mt-1 text-xs text-zinc-500">{RANGE_SUBTITLES[range] ?? RANGE_SUBTITLES["6m"]}</p>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <span className="flex items-center gap-1.5 text-zinc-600">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
            {fmt(totalIncome)}
          </span>
          <span className="flex items-center gap-1.5 text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            {fmt(totalExpense)}
          </span>
          <span className="font-medium" style={{ color: net >= 0 ? accentColor : "#E11D48" }}>
            Net {net >= 0 ? "+" : "-"}
            {fmt(Math.abs(net))}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <RangePicker range={range} activeColor={accentColor} />
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 w-full"
        style={{ height: 200 }}
        preserveAspectRatio="none"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            x2={width}
            y1={chartHeight * (1 - f)}
            y2={chartHeight * (1 - f)}
            stroke="#F0F0F1"
            strokeWidth={1}
          />
        ))}
        <line x1={0} x2={width} y1={chartHeight} y2={chartHeight} stroke="#E4E4E7" strokeWidth={1} />

        {data.map((d, i) => {
          const groupX = i * groupWidth;
          const incomeH = (d.income / max) * (chartHeight - 8);
          const expenseH = (d.expense / max) * (chartHeight - 8);
          const cx = groupX + groupWidth / 2;
          return (
            <g key={d.key}>
              <rect
                x={cx - barWidth - 2}
                y={chartHeight - incomeH}
                width={barWidth}
                height={Math.max(incomeH, d.income > 0 ? 2 : 0)}
                rx={3}
                fill={accentColor}
                opacity={0.9}
              >
                <title>
                  {d.label}: income {fmt(d.income)}
                </title>
              </rect>
              <rect
                x={cx + 2}
                y={chartHeight - expenseH}
                width={barWidth}
                height={Math.max(expenseH, d.expense > 0 ? 2 : 0)}
                rx={3}
                fill="#FB7185"
                opacity={0.85}
              >
                <title>
                  {d.label}: expenses {fmt(d.expense)}
                </title>
              </rect>
              <text x={cx} y={height - 6} textAnchor="middle" fontSize={11} fill="#A1A1AA">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
