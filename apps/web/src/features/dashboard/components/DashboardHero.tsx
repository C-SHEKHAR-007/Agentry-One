import { Link } from "react-router-dom";
import { Plus, Sparkles } from "lucide-react";
import type { SystemHealth } from "../../../models";
import { useNow } from "../../../hooks/useNow";
import { greeting } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { OrchestrationScene } from "../../../components/common/three/OrchestrationScene";
import { buttonVariants } from "../../../components/ui/button";

function secondsAgo(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  return s < 2 ? "just now" : `${s}s ago`;
}

function ServiceChip({ label, ok }: { label: string; ok: boolean | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur">
      <span className={cn("h-1.5 w-1.5 rounded-full", ok === undefined ? "bg-muted-foreground/50" : ok ? "bg-success" : "bg-destructive")} />
      {label}
    </span>
  );
}

/** "AI control center" hero: greeting, a one-line system verdict with live
 * service status, and the 3D orchestration core (busier when more runs are
 * in flight). */
export function DashboardHero({
  name,
  health,
  healthUpdatedAt,
  activeRuns,
  agentCount,
}: {
  name: string;
  health: SystemHealth | undefined;
  healthUpdatedAt: number;
  activeRuns: number;
  agentCount: number;
}) {
  const now = useNow(1000);
  const workersOnline = health?.workers.filter((w) => w.online).length ?? 0;
  const coreOk = health ? health.api && health.db && health.redis : undefined;
  const verdict =
    coreOk === undefined
      ? "Checking your orchestration system…"
      : !coreOk
        ? "Your orchestration system is degraded — a core service is down."
        : health && health.workers.length > 0 && workersOnline === 0
          ? "Core services are healthy, but no agent workers are online."
          : "Your orchestration system is healthy.";
  const tone = coreOk === undefined ? "muted" : !coreOk ? "bad" : workersOnline === 0 ? "warn" : "good";

  return (
    <section className="glow-border relative overflow-hidden rounded-xl border border-transparent bg-card/60 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_85%_40%,hsl(var(--primary)/0.14),transparent_70%)]" />
      <div className="relative grid items-center gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div className="p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">AI control center</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting()}, <span className="text-primary">{name}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{verdict}</p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                tone === "good" && "bg-success/15 text-success",
                tone === "warn" && "bg-warning/15 text-warning",
                tone === "bad" && "bg-destructive/15 text-destructive",
                tone === "muted" && "bg-secondary text-muted-foreground",
              )}
            >
              <span className="status-dot h-1.5 w-1.5" data-live={tone === "good" ? "true" : undefined} />
              {tone === "good" ? "All systems operational" : tone === "warn" ? "Workers offline" : tone === "bad" ? "Degraded" : "Checking"}
            </span>
            <ServiceChip label="API" ok={health?.api} />
            <ServiceChip label="Postgres" ok={health?.db} />
            <ServiceChip label="Redis" ok={health?.redis} />
            <ServiceChip
              label={health ? `${workersOnline}/${health.workers.length} workers` : "Workers"}
              ok={health ? workersOnline > 0 : undefined}
            />
            {healthUpdatedAt > 0 && (
              <span className="ml-1 font-mono text-[11px] text-muted-foreground/80">updated {secondsAgo(healthUpdatedAt, now)}</span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/builder" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> New workflow
            </Link>
            <Link to="/studio" className={buttonVariants({ variant: "secondary" })}>
              <Sparkles className="h-4 w-4" /> Open Content Studio
            </Link>
          </div>
        </div>

        <div className="relative h-64 sm:h-72 lg:h-[19rem]">
          <OrchestrationScene activity={activeRuns} nodes={Math.min(Math.max(agentCount, 5), 9)} className="h-full w-full" />
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border/60 bg-background/60 px-3 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur">
            {activeRuns > 0 ? `${activeRuns} run${activeRuns === 1 ? "" : "s"} in flight` : "idle · waiting for work"}
          </div>
        </div>
      </div>
    </section>
  );
}
