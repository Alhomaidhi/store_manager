"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Result {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
}

export default function AddStorePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function addStore(placeId: string) {
    setAdding(placeId);
    setError(null);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add store");
      router.push(`/stores/${data.store.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add store");
      setAdding(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Add a store</h1>
        <p className="text-[var(--muted)] text-sm">
          Search Google Maps and pick your location.
        </p>
      </div>

      <form onSubmit={search} className="card">
        <label className="block text-sm font-medium mb-2">
          Store name & city
        </label>
        <div className="flex gap-2">
          <input
            className="input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Blue Bottle Coffee, San Francisco"
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-sm text-[var(--danger)]">{error}</div>
        )}
      </form>

      {results.length > 0 && (
        <div className="card">
          <div className="text-sm text-[var(--muted)] mb-3">
            {results.length} result{results.length === 1 ? "" : "s"}. Click to add.
          </div>
          <div className="divide-y divide-[var(--border)]">
            {results.map((r) => (
              <div
                key={r.placeId}
                className="flex items-center justify-between py-3"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5 truncate">
                    {r.address}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {r.rating ? `★ ${r.rating.toFixed(1)}` : "No rating"}
                    {r.userRatingCount ? ` · ${r.userRatingCount} reviews` : ""}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => addStore(r.placeId)}
                  disabled={adding === r.placeId}
                >
                  {adding === r.placeId ? "Adding…" : "Add"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
