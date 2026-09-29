import { Link } from "react-router-dom";
import {
  BarChart3,
  Bot,
  Clapperboard,
  Code2,
  Mic,
  PenLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Agent } from "../api/types";
import type { ComingSoonAgent } from "../data/comingSoonAgents";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

const ICONS: Record<string, LucideIcon> = {
  Clapperboard,
  PenLine,
  BarChart3,
  Mic,
  Code2,
};

export function InstalledAgentCard({
  agent,
  runs,
  online,
  delay = 0,
}: {
  agent: Agent;
  runs?: number;
  online?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Link to={`/agents/${agent.id}`} className="group block h-full">
        <Card glass className="flex h-full flex-col p-5 transition-colors group-hover:border-primary/50">
          <div className="flex items-start justify-between">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="flex items-center gap-1.5">
              {agent.id.startsWith("custom-") ? (
                <Badge variant="secondary" className="bg-primary/15 text-primary border border-primary/30 text-[11px]">
                  Custom
                </Badge>
              ) : (
                <Badge variant="success" className="text-[11px]">
                  Installed
                </Badge>
              )}
              {online !== undefined && (
                <span
                  className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-secondary border border-border"
                  title={online ? "Worker Online" : "Worker Offline"}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-success" : "bg-destructive"}`} />
                  <span className="text-[11px] text-muted-foreground">{online ? "Online" : "Offline"}</span>
                </span>
              )}
            </div>
          </div>
          <h3 className="mt-4 text-sm font-semibold group-hover:text-primary">{agent.name}</h3>
          <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
            {agent.description}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              v{agent.version}
              {runs != null ? ` · ${runs} runs` : ""}
            </span>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

export function ComingSoonAgentCard({
  agent,
  delay = 0,
}: {
  agent: ComingSoonAgent;
  delay?: number;
}) {
  const Icon = ICONS[agent.icon] ?? Bot;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="flex h-full select-none flex-col p-5 opacity-60" aria-disabled>
        <div className="flex items-start justify-between">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <Badge variant="outline">Coming Soon</Badge>
        </div>
        <h3 className="mt-4 text-sm font-semibold text-muted-foreground">{agent.name}</h3>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground/70">{agent.tagline}</p>
        <div className="mt-4">
          <Badge variant="secondary" className="text-[11px]">
            {agent.category}
          </Badge>
        </div>
      </Card>
    </motion.div>
  );
}
