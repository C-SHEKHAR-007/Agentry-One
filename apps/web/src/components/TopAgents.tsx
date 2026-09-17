import { Link } from "react-router-dom";
import { Bot } from "lucide-react";
import type { AgentStats } from "../api/types";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
];

export function TopAgents({ agents }: { agents: AgentStats[] }) {
  if (agents.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">No agent runs yet.</p>;
  }
  return (
    <div className="space-y-3.5">
      {agents.slice(0, 5).map((a, i) => (
        <Link key={a.agentId} to={`/agents/${a.agentId}`} className="group block">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{
                backgroundColor: `color-mix(in srgb, ${COLORS[i % COLORS.length]} 15%, transparent)`,
                color: COLORS[i % COLORS.length],
              }}
            >
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium group-hover:text-primary">{a.name}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {Math.round(a.share * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{a.runs} runs</p>
            </div>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${a.share * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
            />
          </div>
        </Link>
      ))}
    </div>
  );
}
