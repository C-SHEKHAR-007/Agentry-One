import { useState } from "react";
import { Link } from "react-router-dom";
import type { AgentStats } from "../../api/types";
import { formatDuration, formatTokens, formatUsd } from "../../lib/format";
import { cn } from "../../lib/utils";

const METRICS = {
  runs: { label: "Runs", value: (a: AgentStats) => a.runs, format: (n: number) => `${n} run${n === 1 ? "" : "s"}` },
  tokens: { label: "Tokens", value: (a: AgentStats) => a.tokens ?? 0, format: (n: number) => formatTokens(n, { compact: true, zero: true }) },
  cost: { label: "Cost", value: (a: AgentStats) => a.costUsd ?? 0, format: (n: number) => formatUsd(n) },
  latency: { label: "Latency", value: (a: AgentStats) => a.avgDurationMs ?? 0, format: (n: number) => (n ? formatDuration(n) : "—") },
} as const;
type Metric = keyof typeof METRICS;

/** Per-agent usage as ranked bars, switchable between runs, tokens, cost and
 * average latency (last 30 days). */
export function UsageBars({ agents }: { agents: AgentStats[] }) {
  const [metric, setMetric] = useState<Metric>("runs");
  const m = METRICS[metric];
  const rows = agents
    .map((a) => ({ a, v: m.value(a) }))
    .filter((r) => r.v > 0)
    .sort((x, y) => y.v - x.v)
    .slice(0, 6);
  const max = Math.max(...rows.map((r) => r.v), 0);
  const total = rows.reduce((n, r) => n + r.v, 0);

  return (
    <div>
      <div className="mb-4 flex rounded-lg border border-border/60 bg-muted/30 p-0.5" role="tablist" aria-label="Usage metric">
        {(Object.keys(METRICS) as Metric[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={metric === k}
            onClick={() => setMetric(k)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              metric === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {METRICS[k].label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {metric === "tokens"
            ? "No token usage reported yet — text agents report it when they run."
            : metric === "cost"
              ? "Nothing spent — every run so far used a free local provider."
              : "No runs in the last 30 days."}
        </p>
      ) : (
        <ul className="space-y-3.5">
          {rows.map(({ a, v }, i) => (
            <li key={a.agentId}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <Link to={`/agents/${a.agentId}`} className="min-w-0 truncate font-medium hover:text-primary">
                  {a.name}
                </Link>
                <span className="shrink-0 font-mono tabular text-muted-foreground">
                  {m.format(v)}
                  {metric !== "latency" && total > 0 && <span className="ml-2 text-muted-foreground/60">{Math.round((v / total) * 100)}%</span>}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-700", i === 0 ? "bg-primary" : "bg-primary/55")}
                  style={{ width: `${max ? Math.max((v / max) * 100, 3) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
