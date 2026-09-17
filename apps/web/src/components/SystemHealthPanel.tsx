import { Globe, Database, Layers, Cpu } from "lucide-react";
import type { SystemHealth } from "../api/types";
import { cn } from "../lib/utils";

function Row({
  icon: Icon,
  label,
  ok,
  okLabel = "Healthy",
  badLabel = "Down",
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  ok: boolean;
  okLabel?: string;
  badLabel?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0" title={tooltip}>
      <span className="flex items-center gap-2 text-xs truncate max-w-[200px]">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate text-foreground/90">{label}</span>
      </span>
      <span
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium shrink-0 ml-2",
          ok ? "text-success" : "text-destructive",
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-success" : "bg-destructive")} />
        {ok ? okLabel : badLabel}
      </span>
    </div>
  );
}

export function SystemHealthPanel({ health }: { health: SystemHealth }) {
  const onlineCount = health.workers.filter((w) => w.online).length;

  return (
    <div className="space-y-3">
      {/* Core Services */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
          Core Services
        </p>
        <div className="rounded-lg border border-border/50 bg-white/[0.02] px-3 py-0.5">
          <Row icon={Globe} label="API Server" ok={health.api} />
          <Row icon={Database} label="PostgreSQL Database" ok={health.db} />
          <Row icon={Layers} label="Redis Queue Broker" ok={health.redis} />
        </div>
      </div>

      {/* Agent Workers (Scrollable) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Agent Workers
          </p>
          <span className="text-[10px] text-muted-foreground font-mono">
            {onlineCount}/{health.workers.length} running
          </span>
        </div>

        <div className="rounded-lg border border-border/50 bg-white/[0.02] px-3 py-0.5 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
          {health.workers.map((w) => {
            const prettyName = w.agentId
              .replace(/^custom-/, "")
              .replace(/-\d+$/, "")
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");

            return (
              <Row
                key={w.queue}
                icon={Cpu}
                label={prettyName}
                ok={w.online}
                okLabel="Running"
                badLabel="Offline"
                tooltip={`Worker for ${w.agentId} (${w.queue})`}
              />
            );
          })}
          {health.workers.length === 0 && (
            <p className="py-2 text-xs text-muted-foreground">No workers registered.</p>
          )}
        </div>
      </div>
    </div>
  );
}
