"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

export function RatingDistributionChart({
  data,
}: {
  data: Array<{ rating: string; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="rating" stroke="#6b7280" fontSize={12} />
        <YAxis stroke="#6b7280" fontSize={12} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyVolumeChart({
  data,
}: {
  data: Array<{ month: string; count: number; avgRating: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
        <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} allowDecimals={false} />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 5]}
          stroke="#6b7280"
          fontSize={12}
        />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="count"
          stroke="#2563eb"
          strokeWidth={2}
          name="Reviews"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="avgRating"
          stroke="#16a34a"
          strokeWidth={2}
          name="Avg rating"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
