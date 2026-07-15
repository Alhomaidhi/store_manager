"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Validated data-viz palette (passes CVD + contrast checks on white cards).
const BLUE = "#2a78d6";
const BLUE_SOFT = "#cde2fb";
const GREEN = "#008300";
const RED = "#e34948";
const NEUTRAL = "#e1e0d9";
const INK = "#0b0b0b";
const MUTED = "#898781";
const GRID = "#e9e8e3";
const BASELINE = "#c3c2b7";

const tooltipStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 2px 8px rgba(11,11,11,0.06)",
} as const;

const axisProps = {
  stroke: MUTED,
  fontSize: 12,
  tickLine: false,
  axisLine: { stroke: BASELINE },
} as const;

export function RatingDistributionChart({
  data,
}: {
  data: Array<{ rating: string; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} layout="vertical" margin={{ right: 36 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...axisProps} />
        <YAxis type="category" dataKey="rating" width={34} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
        <Bar dataKey="count" name="Reviews" fill={BLUE} barSize={16} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" fill={INK} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyVolumeChart({
  data,
}: {
  data: Array<{ month: string; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" minTickGap={24} {...axisProps} />
        <YAxis allowDecimals={false} width={34} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
        <Bar dataKey="count" name="Reviews" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RatingTrendChart({
  data,
}: {
  data: Array<{ month: string; avgRating: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" minTickGap={24} {...axisProps} />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} width={34} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="avgRating"
          name="Avg rating"
          stroke={GREEN}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CumulativeGrowthChart({
  data,
}: {
  data: Array<{ month: string; total: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" minTickGap={24} {...axisProps} />
        <YAxis allowDecimals={false} width={40} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="total"
          name="Total reviews"
          stroke={BLUE}
          strokeWidth={2}
          fill={BLUE_SOFT}
          fillOpacity={0.7}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function KeywordsChart({
  data,
}: {
  data: Array<{ word: string; count: number }>;
}) {
  const height = Math.max(120, data.length * 28 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ right: 36 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...axisProps} />
        <YAxis type="category" dataKey="word" width={110} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
        <Bar dataKey="count" name="Mentions" fill={BLUE} barSize={14} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" fill={INK} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StoreRatingsChart({
  data,
}: {
  data: Array<{ name: string; avgRating: number }>;
}) {
  const height = Math.max(120, data.length * 34 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ right: 44 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} {...axisProps} />
        <YAxis type="category" dataKey="name" width={150} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
        <Bar dataKey="avgRating" name="Avg rating" fill={BLUE} barSize={16} radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey="avgRating"
            position="right"
            fill={INK}
            fontSize={12}
            formatter={(v: number) => v.toFixed(2)}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Part-to-whole sentiment strip: positive ↔ negative are the diverging poles
 * (blue/red), neutral is the gray midpoint. Counts live in the legend, so the
 * bar itself stays clean; 2px surface gaps separate the segments.
 */
export function SentimentBar({
  positive,
  neutral,
  negative,
}: {
  positive: number;
  neutral: number;
  negative: number;
}) {
  const total = positive + neutral + negative;
  if (total === 0) {
    return <p className="text-sm text-[var(--muted)]">No reviews yet.</p>;
  }
  const pct = (n: number) => (n / total) * 100;
  const segments = [
    { label: "Positive (4–5★)", value: positive, color: BLUE },
    { label: "Neutral (3★)", value: neutral, color: NEUTRAL },
    { label: "Negative (1–2★)", value: negative, color: RED },
  ].filter((s) => s.value > 0);

  return (
    <div>
      <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.value} (${pct(s.value).toFixed(0)}%)`}
            style={{ width: `${pct(s.value)}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {[
          { label: "Positive (4–5★)", value: positive, color: BLUE },
          { label: "Neutral (3★)", value: neutral, color: NEUTRAL },
          { label: "Negative (1–2★)", value: negative, color: RED },
        ].map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-[var(--ink)]">{s.label}</span>
            <span className="text-[var(--muted)]">
              {s.value} · {pct(s.value).toFixed(0)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
