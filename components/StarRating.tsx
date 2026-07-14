export function StarRating({ value, size = 14 }: { value: number | null; size?: number }) {
  if (value == null) return <span className="text-[var(--muted)] text-sm">No rating</span>;
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-1">
      <span style={{ fontSize: size, letterSpacing: 1 }}>
        {"★".repeat(full)}
        {half ? "☆" : ""}
        <span className="text-[var(--border)]">{"★".repeat(5 - full - (half ? 1 : 0))}</span>
      </span>
      <span className="text-xs text-[var(--muted)]">{value.toFixed(1)}</span>
    </span>
  );
}
