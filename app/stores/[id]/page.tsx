import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreReport } from "@/lib/reports";
import { StarRating } from "@/components/StarRating";
import { RatingDistributionChart, MonthlyVolumeChart } from "@/components/Charts";
import { SyncButton, DeleteButton } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getStoreReport(id);
  if (!report) notFound();

  const { store, reviewCount, avgRating, ratingDistribution, monthlyVolume, topKeywords, recentNegative } = report;

  const distributionData = [5, 4, 3, 2, 1].map((r) => ({
    rating: `${r}★`,
    count: ratingDistribution[r as 1 | 2 | 3 | 4 | 5],
  }));

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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">
            Google rating
          </div>
          <div className="text-2xl font-semibold mt-1">
            {store.rating ? store.rating.toFixed(1) : "—"}
          </div>
          <div className="text-xs text-[var(--muted)] mt-0.5">
            {store.total_ratings ?? 0} total on Google
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">
            Reviews stored
          </div>
          <div className="text-2xl font-semibold mt-1">{reviewCount}</div>
        </div>
        <div className="card">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">
            Avg (stored)
          </div>
          <div className="text-2xl font-semibold mt-1">
            {avgRating ? avgRating.toFixed(2) : "—"}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">
            Negative (≤2★)
          </div>
          <div className="text-2xl font-semibold mt-1 text-[var(--danger)]">
            {ratingDistribution[1] + ratingDistribution[2]}
          </div>
        </div>
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
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Top keywords</h2>
        {topKeywords.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No text reviews yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {topKeywords.map((k) => (
              <span
                key={k.word}
                className="badge"
                style={{
                  background: "#eff6ff",
                  color: "#1e40af",
                  fontSize: 12 + Math.min(k.count, 6),
                }}
              >
                {k.word} <span className="opacity-60">×{k.count}</span>
              </span>
            ))}
          </div>
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
                    {r.author_name ?? "Anonymous"}
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
    <div className="flex items-center justify-center h-[220px] text-sm text-[var(--muted)]">
      No data yet. Sync to fetch reviews.
    </div>
  );
}
