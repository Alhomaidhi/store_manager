"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Something went wrong</h1>
        <p className="text-[var(--muted)] text-sm">
          The page hit a server error. If this is a fresh deploy, check{" "}
          <Link href="/api/health" className="text-[var(--accent)] underline">
            /api/health
          </Link>{" "}
          for env and database diagnostics.
        </p>
      </div>

      <div className="card">
        <div className="text-xs text-[var(--muted)] uppercase tracking-wide mb-2">
          Error message
        </div>
        <pre className="text-sm whitespace-pre-wrap break-words">{error.message}</pre>
        {error.digest && (
          <div className="text-xs text-[var(--muted)] mt-2">
            digest: {error.digest}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/api/health" className="btn btn-secondary">
          Open /api/health
        </Link>
      </div>
    </div>
  );
}
