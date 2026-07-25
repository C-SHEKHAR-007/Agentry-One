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
      <Card glass className="p-5 hover:shadow-lg transition-shadow duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                  color,
                  boxShadow: `0 0 12px color-mix(in srgb, ${color} 20%, transparent)`,
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate text-sm text-muted-foreground">{label}</span>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
            {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
          </div>
          {series && (
            <Sparkline values={series} color={color} className="shrink-0 self-end" />
          )}
        </div>
      </Card>
    </motion.div>
  );
}
