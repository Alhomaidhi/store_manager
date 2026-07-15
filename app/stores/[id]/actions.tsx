"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const PENDING_POLL_MS = 15_000;

export function SyncButton({
  storeId,
  initialPending,
}: {
  storeId: string;
  initialPending: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(initialPending);
  const [msg, setMsg] = useState<string | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(async () => {
    setLoading(true);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    setMsg(null);
    try {
      const res = await fetch(`/api/stores/${storeId}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok && res.status !== 202) throw new Error(data.error ?? "Sync failed");
      if (data.status === "pending") {
        setPending(true);
        setMsg("Pulling reviews — this page will update when it's done");
        return;
      }
      setPending(false);
      setMsg(
        data.added > 0
          ? `+${data.added} new review${data.added === 1 ? "" : "s"}`
          : "No new reviews"
      );
      msgTimer.current = setTimeout(() => setMsg(null), 4000);
      router.refresh();
    } catch (err) {
      setPending(false);
      setMsg(err instanceof Error ? err.message : "Sync failed");
      msgTimer.current = setTimeout(() => setMsg(null), 8000);
    } finally {
      setLoading(false);
    }
  }, [storeId, router]);

  // While a pull is running on Outscraper's side, keep checking. Each call
  // only polls the tracked job — it never submits (or bills) a new one.
  useEffect(() => {
    if (!pending) return;
    sync(); // check right away (e.g. when the page loads mid-pull)
    const timer = setInterval(sync, PENDING_POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-[var(--muted)]">{msg}</span>}
      <button
        className="btn btn-secondary"
        onClick={sync}
        disabled={loading || pending}
      >
        {pending ? "Sync in progress…" : loading ? "Syncing…" : "Sync now"}
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
