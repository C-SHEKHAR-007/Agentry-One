import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card } from "./ui/card";
import { Sparkline } from "./ui/sparkline";
import { cn } from "../lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  series,
  color = "hsl(var(--chart-1))",
  delay = 0,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  series?: number[];
  color?: string;
  delay?: number;
  to?: string;
}) {
  const content = (
    <Card
      glass
      className={cn(
        "p-5 transition-all duration-200",
        to
          ? "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 group cursor-pointer"
          : "hover:shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                  color,
                  boxShadow: `0 0 12px color-mix(in srgb, ${color} 20%, transparent)`,
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {label}
              </span>
            </div>
            {to && (
              <span className="text-[10px] text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0">
                ↗
              </span>
            )}
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight group-hover:text-primary transition-colors">
            {value}
          </div>
          {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
        </div>
        {series && (
          <Sparkline values={series} color={color} className="shrink-0 self-end" />
        )}
      </div>
    </Card>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      {to ? (
        <Link to={to} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </motion.div>
  );
}
