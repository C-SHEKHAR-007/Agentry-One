export function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const then = typeof iso === "string" ? new Date(iso) : iso;
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return then.toLocaleDateString();
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function formatPercent(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

/** 1284 -> "1,284"; 48210 -> "48.2k"; null/0 -> "—" unless zero is allowed. */
export function formatTokens(n: number | null | undefined, { compact = false, zero = false } = {}): string {
  if (n == null || (!zero && n === 0)) return "—";
  if (compact && n >= 10_000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return n.toLocaleString("en-US");
}

/** Costs are often fractions of a cent: keep 4 decimals below $1. */
export function formatUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n === 0) return "$0";
  return n < 1 ? `$${n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}` : `$${n.toFixed(2)}`;
}

/** "16:03:42" in the viewer's time zone. */
export function formatClock(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/** Short, stable run id for display: RUN_8F92A1. */
export function runCode(id: string, prefix = "RUN"): string {
  return `${prefix}_${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
