import Link from "next/link";
import { getDashboardSummary } from "@/lib/reports";
import { StarRating } from "@/components/StarRating";
import { MonthlyVolumeChart, StoreRatingsChart } from "@/components/Charts";

export const dynamic = "force-dynamic";

function formatRelative(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function Dashboard() {
  const summary = await getDashboardSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
        <p className="text-[var(--muted)] text-sm">
          Overview across all your stores.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">
            Stores
          </div>
          <div className="text-3xl font-semibold mt-1">{summary.totalStores}</div>
        </div>
        <div className="card">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">
            Reviews stored
          </div>
          <div className="text-3xl font-semibold mt-1">{summary.totalReviews}</div>
        </div>
        <div className="card">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">
            Avg rating
          </div>
          <div className="text-3xl font-semibold mt-1">
            {summary.avgRating ? summary.avgRating.toFixed(2) : "—"}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">
            Last 30 days
          </div>
          <div className="text-3xl font-semibold mt-1">{summary.reviewsLast30}</div>
        </div>
      </div>

      {summary.totalReviews > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="font-semibold mb-3">Average rating by store</h2>
            <StoreRatingsChart
              data={summary.storesByRating
                .filter((s) => s.avgRating !== null)
                .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
                .map((s) => ({
                  name: s.name,
                  avgRating: Number((s.avgRating ?? 0).toFixed(2)),
                }))}
            />
          </div>
          <div className="card">
            <h2 className="font-semibold mb-3">
              Review volume by month (all stores)
            </h2>
            <MonthlyVolumeChart data={summary.monthlyVolume} />
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Your stores</h2>
        {summary.storesByRating.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--muted)] mb-4">
              No stores yet. Add your first one to start pulling reviews.
            </p>
            <Link href="/stores/new" className="btn btn-primary">
              + Add Store
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {summary.storesByRating.map((s) => (
              <Link
                key={s.id}
                href={`/stores/${s.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
              >
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {s.reviewCount} reviews · synced {formatRelative(s.lastSyncedAt)}
                  </div>
                </div>
                <StarRating value={s.avgRating} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
