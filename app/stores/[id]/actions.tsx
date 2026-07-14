"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncButton({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/stores/${storeId}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setMsg(
        data.added > 0
          ? `+${data.added} new review${data.added === 1 ? "" : "s"}`
          : "No new reviews"
      );
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-[var(--muted)]">{msg}</span>}
      <button className="btn btn-secondary" onClick={sync} disabled={loading}>
        {loading ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
}

export function DeleteButton({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function del() {
    if (!confirm("Remove this store and all its stored reviews?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stores/${storeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-danger" onClick={del} disabled={loading}>
      {loading ? "Removing…" : "Remove"}
    </button>
  );
}
