import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card } from "./ui/card";
import { Sparkline } from "./ui/sparkline";

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  series,
  color = "hsl(var(--chart-1))",
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  series?: number[];
  color?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card glass className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-md"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="truncate">{label}</span>
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        {series && <Sparkline values={series} color={color} className="shrink-0" />}
      </Card>
    </motion.div>
  );
}
