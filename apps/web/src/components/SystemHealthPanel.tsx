import { Globe, Database, Layers, Cpu } from "lucide-react";
import type { SystemHealth } from "../api/types";
import { cn } from "../lib/utils";

function Row({
  icon: Icon,
  label,
  ok,
  okLabel = "Healthy",
  badLabel = "Down",
}: {
  icon: React.ElementType;
  label: string;
  ok: boolean;
  okLabel?: string;
  badLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2.5 last:border-0">
      <span className="flex items-center gap-2.5 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
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
  const allOk =
    health.api && health.db && health.redis && health.workers.every((w) => w.online);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs",
            allOk ? "text-success" : "text-warning",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", allOk ? "bg-success" : "bg-warning")} />
          {allOk ? "All systems operational" : "Degraded"}
        </span>
      </div>
      <Row icon={Globe} label="API" ok={health.api} />
      <Row icon={Database} label="Database" ok={health.db} />
      <Row icon={Layers} label="Redis Queue" ok={health.redis} />
      {health.workers.map((w) => (
        <Row
          key={w.queue}
          icon={Cpu}
          label={`Worker · ${w.agentId}`}
          ok={w.online}
          okLabel="Running"
          badLabel="Offline"
        />
      ))}
    </div>
  );
}
