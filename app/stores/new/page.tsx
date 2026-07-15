"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddStorePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addStore(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add store");
      router.push(`/stores/${data.store.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add store");
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Add a store</h1>
        <p className="text-[var(--muted)] text-sm">
          Paste the store&apos;s Google Maps link and give the branch a name.
        </p>
      </div>

      <form onSubmit={addStore} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Google Maps link
          </label>
          <input
            className="input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://maps.app.goo.gl/… or https://www.google.com/maps/place/…"
            autoFocus
            required
          />
          <p className="text-xs text-[var(--muted)] mt-1">
            On Google Maps, open the store and use Share → Copy link.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Branch name <span className="text-[var(--muted)] font-normal">(optional)</span>
          </label>
          <input
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Riyadh — Olaya Branch"
            maxLength={120}
          />
          <p className="text-xs text-[var(--muted)] mt-1">
            Shown instead of the Google listing name. Leave empty to use the
            name from Google Maps.
          </p>
        </div>

        <button className="btn btn-primary" type="submit" disabled={adding}>
          {adding
            ? "Adding… (pulling the full review history — large stores can take a few minutes)"
            : "Add store"}
        </button>

        {error && (
          <div className="text-sm text-[var(--danger)]">{error}</div>
        )}
      </form>
    </div>
  );
}
