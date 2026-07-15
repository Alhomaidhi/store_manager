import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreReport } from "@/lib/reports";
import { StarRating } from "@/components/StarRating";
import {
  RatingDistributionChart,
  MonthlyVolumeChart,
  RatingTrendChart,
  CumulativeGrowthChart,
  KeywordsChart,
  SentimentBar,
} from "@/components/Charts";
import { SyncButton, DeleteButton } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Delta({
  value,
  goodWhenUp = true,
  suffix = "",
}: {
  value: number | null;
  goodWhenUp?: boolean;
  suffix?: string;
}) {
  if (value === null || value === 0) {
    return <span className="text-xs text-[var(--muted)]">no change vs prior 30d</span>;
  }
  const up = value > 0;
  const good = up === goodWhenUp;
  return (
    <span
      className="text-xs font-medium"
      style={{ color: good ? "#006300" : "var(--danger)" }}
    >
      {up ? "↑" : "↓"} {Math.abs(value) % 1 === 0 ? Math.abs(value) : Math.abs(value).toFixed(2)}
      {suffix} vs prior 30d
    </span>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="text-xs text-[var(--muted)] uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getStoreReport(id);
  if (!report) notFound();

  const {
    store,
    reviewCount,
    avgRating,
    ratingDistribution,
    monthlyVolume,
    cumulative,
    sentiment,
    recentStats,
    topKeywords,
    recentNegative,
  } = report;

  const distributionData = [5, 4, 3, 2, 1].map((r) => ({
    rating: `${r}★`,
    count: ratingDistribution[r as 1 | 2 | 3 | 4 | 5],
  }));

  const positiveShare =
    reviewCount === 0 ? null : (sentiment.positive / reviewCount) * 100;
  const negativeShare =
    reviewCount === 0 ? null : (sentiment.negative / reviewCount) * 100;
  const avgDelta =
    recentStats.last30Avg !== null && recentStats.prev30Avg !== null
      ? Number((recentStats.last30Avg - recentStats.prev30Avg).toFixed(2))
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold mt-2">
            {store.custom_name?.trim() || store.name}
          </h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            {store.custom_name?.trim() ? `${store.name} · ` : ""}
            {store.address}
          </p>
          {store.google_url && (
            <a
              href={store.google_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[var(--accent)] hover:underline mt-1 inline-block"
            >
              View on Google Maps ↗
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <SyncButton
            storeId={store.id}
            initialPending={!!store.pending_request_id}
          />
          <DeleteButton storeId={store.id} />
        </div>
      </div>

      {store.pending_request_id && (
        <div className="card text-sm text-[var(--muted)]">
          Review pull in progress — large stores can take a few minutes. The
          reports below update automatically as soon as it finishes.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatTile
          label="Google rating"
          value={store.rating ? store.rating.toFixed(1) : "—"}
          sub={
            <span className="text-xs text-[var(--muted)]">
              {store.total_ratings ?? 0} total on Google
            </span>
          }
        />
        <StatTile
          label="Avg (stored)"
          value={avgRating ? avgRating.toFixed(2) : "—"}
          sub={
            <span className="text-xs text-[var(--muted)]">
              across {reviewCount} review{reviewCount === 1 ? "" : "s"}
            </span>
          }
        />
        <StatTile
          label="Last 30 days"
          value={String(recentStats.last30Count)}
          sub={<Delta value={recentStats.last30Count - recentStats.prev30Count} />}
        />
        <StatTile
          label="30-day avg"
          value={recentStats.last30Avg !== null ? recentStats.last30Avg.toFixed(2) : "—"}
          sub={<Delta value={avgDelta} />}
        />
        <StatTile
          label="Positive share"
          value={positiveShare !== null ? `${positiveShare.toFixed(0)}%` : "—"}
          sub={
            <span className="text-xs text-[var(--muted)]">
              {sentiment.positive} rated 4–5★
            </span>
          }
        />
        <StatTile
          label="Negative share"
          value={negativeShare !== null ? `${negativeShare.toFixed(0)}%` : "—"}
          sub={
            <span className="text-xs text-[var(--muted)]">
              {sentiment.negative} rated 1–2★
            </span>
          }
        />
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Sentiment split</h2>
        <SentimentBar
          positive={sentiment.positive}
          neutral={sentiment.neutral}
          negative={sentiment.negative}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-3">Rating distribution</h2>
          {reviewCount === 0 ? (
            <EmptyChart />
          ) : (
            <RatingDistributionChart data={distributionData} />
          )}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Review volume by month</h2>
          {monthlyVolume.length === 0 ? (
            <EmptyChart />
          ) : (
            <MonthlyVolumeChart data={monthlyVolume} />
          )}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Average rating by month</h2>
          {monthlyVolume.length === 0 ? (
            <EmptyChart />
          ) : (
            <RatingTrendChart data={monthlyVolume} />
          )}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Review growth (cumulative)</h2>
          {cumulative.length === 0 ? (
            <EmptyChart />
          ) : (
            <CumulativeGrowthChart data={cumulative} />
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Top keywords in reviews</h2>
        {topKeywords.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No text reviews yet.</p>
        ) : (
          <KeywordsChart data={topKeywords.slice(0, 10)} />
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">
          Recent negative reviews ({recentNegative.length})
        </h2>
        {recentNegative.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No 1★ or 2★ reviews stored. Nice.
          </p>
        ) : (
          <div className="space-y-4">
            {recentNegative.map((r) => (
              <div
                key={r.id}
                className="border-l-2 border-[var(--danger)] pl-4"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {r.author_name || "Anonymous"}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    <StarRating value={r.rating} /> · {formatDate(r.published_at)}
                  </div>
                </div>
                {r.text && (
                  <p className="text-sm mt-2 whitespace-pre-wrap">{r.text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-[var(--muted)] text-center pt-4">
        The first sync pulls the full review history; after that, syncs only
        fetch new reviews. Click <b>Sync now</b> periodically to stay current.
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[190px] text-sm text-[var(--muted)]">
      No data yet. Sync to fetch reviews.
    </div>
  );
}
