import { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { buildCron, describeCron, nextRuns, parseCronSpec, type CronSpec } from "../../lib/cron";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";

const DAY_CHIPS = [
  { d: 1, label: "Mon" },
  { d: 2, label: "Tue" },
  { d: 3, label: "Wed" },
  { d: 4, label: "Thu" },
  { d: 5, label: "Fri" },
  { d: 6, label: "Sat" },
  { d: 0, label: "Sun" },
];

const KINDS: Array<{ kind: CronSpec["kind"]; label: string }> = [
  { kind: "daily", label: "Every day" },
  { kind: "weekdays", label: "Every weekday" },
  { kind: "weekly", label: "On certain days" },
  { kind: "monthly", label: "Every month" },
  { kind: "hourly", label: "Every hour" },
  { kind: "everyMinutes", label: "Every few minutes" },
  { kind: "custom", label: "Custom (cron)" },
];

const timeOf = (s: CronSpec) => ("time" in s ? s.time : "09:00");

/** The spec to switch to when the frequency changes, keeping the time. */
function respec(kind: CronSpec["kind"], prev: CronSpec): CronSpec {
  const t = timeOf(prev);
  switch (kind) {
    case "daily":
    case "weekdays":
      return { kind, time: t };
    case "weekly":
      return { kind, days: prev.kind === "weekly" ? prev.days : [2], time: t };
    case "monthly":
      return { kind, day: 1, time: t };
    case "hourly":
      return { kind, minute: 0 };
    case "everyMinutes":
      return { kind, every: 15 };
    case "custom":
      return { kind, expr: buildCron(prev) };
  }
}

const fmtRun = (d: Date) => d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * "Every [Tuesday] at [09:00]" instead of a raw cron box, with the next three
 * runs shown so the schedule is never a guess. Controlled: `value` is the cron
 * expression; times are in `timezone` (the browser's, saved with the schedule).
 */
export function CronBuilder({ value, onChange, timezone, now }: { value: string; onChange: (expr: string) => void; timezone: string; now?: Date }) {
  // Keep the spec locally so "custom" survives an expression the builder could also show.
  const [spec, setSpec] = useState<CronSpec>(() => parseCronSpec(value));
  const set = (s: CronSpec) => {
    setSpec(s);
    onChange(buildCron(s));
  };
  const runs = useMemo(() => nextRuns(value, now ?? new Date(), 3), [value, now]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="cron-kind">Repeat</Label>
          <Select id="cron-kind" value={spec.kind} onChange={(e) => set(respec(e.target.value as CronSpec["kind"], spec))} className="w-48">
            {KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>

        {spec.kind === "monthly" && (
          <div>
            <Label htmlFor="cron-day">On day</Label>
            <Input id="cron-day" type="number" min={1} max={28} value={spec.day} onChange={(e) => set({ ...spec, day: Number(e.target.value) || 1 })} className="w-20" />
          </div>
        )}
        {"time" in spec && (
          <div>
            <Label htmlFor="cron-time">At</Label>
            <Input id="cron-time" type="time" value={spec.time} onChange={(e) => e.target.value && set({ ...spec, time: e.target.value })} className="w-32" />
          </div>
        )}
        {spec.kind === "hourly" && (
          <div>
            <Label htmlFor="cron-minute">At minute</Label>
            <Input id="cron-minute" type="number" min={0} max={59} value={spec.minute} onChange={(e) => set({ ...spec, minute: Number(e.target.value) || 0 })} className="w-20" />
          </div>
        )}
        {spec.kind === "everyMinutes" && (
          <div>
            <Label htmlFor="cron-every">Every (minutes)</Label>
            <Input id="cron-every" type="number" min={1} max={59} value={spec.every} onChange={(e) => set({ ...spec, every: Number(e.target.value) || 1 })} className="w-20" />
          </div>
        )}
        {spec.kind === "custom" && (
          <div className="min-w-48 flex-1">
            <Label htmlFor="cron-expr">Cron expression</Label>
            <Input id="cron-expr" value={spec.expr} placeholder="0 9 * * 2" onChange={(e) => set({ kind: "custom", expr: e.target.value })} className="font-mono" />
          </div>
        )}
      </div>

      {spec.kind === "weekly" && (
        <div role="group" aria-label="Days" className="flex flex-wrap gap-1.5">
          {DAY_CHIPS.map(({ d, label }) => {
            const on = spec.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => set({ ...spec, days: on ? spec.days.filter((x) => x !== d) : [...spec.days, d] })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs">
        <p className="flex items-center gap-1.5 font-medium">
          <CalendarClock className="h-3.5 w-3.5 text-primary" />
          {describeCron(value)} <span className="font-normal text-muted-foreground">({timezone})</span>
        </p>
        {runs.length ? (
          <p className="mt-1 text-muted-foreground" data-testid="next-runs">
            Next: {runs.map(fmtRun).join(" · ")}
          </p>
        ) : (
          <p className="mt-1 text-warning">This expression never runs, or isn't valid.</p>
        )}
        <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">{value}</p>
      </div>
    </div>
  );
}
