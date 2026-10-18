/** Plain-language description of the common cron shapes the scheduler
 * accepts (5 fields: minute hour day-of-month month day-of-week). Anything
 * unusual falls back to the raw expression. */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const isNum = (v: string) => /^\d+$/.test(v);
const time = (h: string, m: string) => `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;

export function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;

  if (mon !== "*") return expr;
  const everyMin = /^\*\/(\d+)$/.exec(min);
  if (everyMin && hour === "*" && dom === "*" && dow === "*") return `Every ${everyMin[1]} min`;
  if (min === "*" && hour === "*" && dom === "*" && dow === "*") return "Every minute";
  const everyHour = /^\*\/(\d+)$/.exec(hour);
  if (isNum(min) && everyHour && dom === "*" && dow === "*") return `Every ${everyHour[1]} h`;
  if (isNum(min) && hour === "*" && dom === "*" && dow === "*") return min === "0" ? "Hourly" : `Hourly at :${min.padStart(2, "0")}`;
  if (!isNum(min) || !isNum(hour)) return expr;

  const at = time(hour, min);
  if (dom === "*" && dow === "*") return `Daily at ${at}`;
  if (dom === "*" && dow === "1-5") return `Weekdays at ${at}`;
  if (dom === "*" && /^[0-6](,[0-6])*$/.test(dow)) return `${dow.split(",").map((d) => DAYS[Number(d)]).join(", ")} at ${at}`;
  if (isNum(dom) && dow === "*") return `Monthly on day ${dom} at ${at}`;
  return expr;
}

/** What the friendly schedule builder can express. Anything else is "custom"
 * and edited as a raw expression. Times are "HH:MM" in the schedule's timezone. */
export type CronSpec =
  | { kind: "daily"; time: string }
  | { kind: "weekdays"; time: string }
  | { kind: "weekly"; days: number[]; time: string }
  | { kind: "monthly"; day: number; time: string }
  | { kind: "hourly"; minute: number }
  | { kind: "everyMinutes"; every: number }
  | { kind: "custom"; expr: string };

const hm = (t: string): [number, number] => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  const h = m ? Math.min(23, Number(m[1])) : 9;
  const mi = m ? Math.min(59, Number(m[2])) : 0;
  return [h, mi];
};

export function buildCron(spec: CronSpec): string {
  switch (spec.kind) {
    case "daily": {
      const [h, m] = hm(spec.time);
      return `${m} ${h} * * *`;
    }
    case "weekdays": {
      const [h, m] = hm(spec.time);
      return `${m} ${h} * * 1-5`;
    }
    case "weekly": {
      const [h, m] = hm(spec.time);
      const days = [...new Set(spec.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
      return `${m} ${h} * * ${days.length ? days.join(",") : "1"}`;
    }
    case "monthly": {
      const [h, m] = hm(spec.time);
      return `${m} ${h} ${Math.min(28, Math.max(1, Math.round(spec.day)))} * *`;
    }
    case "hourly":
      return `${Math.min(59, Math.max(0, Math.round(spec.minute)))} * * * *`;
    case "everyMinutes":
      return `*/${Math.min(59, Math.max(1, Math.round(spec.every)))} * * * *`;
    case "custom":
      return spec.expr.trim();
  }
}

/** The builder spec for an expression, or "custom" when the builder can't show it. */
export function parseCronSpec(expr: string): CronSpec {
  const parts = expr.trim().split(/\s+/);
  const custom: CronSpec = { kind: "custom", expr: expr.trim() };
  if (parts.length !== 5) return custom;
  const [min, hour, dom, mon, dow] = parts;
  if (mon !== "*") return custom;
  const every = /^\*\/(\d+)$/.exec(min);
  if (every && hour === "*" && dom === "*" && dow === "*") return { kind: "everyMinutes", every: Number(every[1]) };
  if (isNum(min) && hour === "*" && dom === "*" && dow === "*") return { kind: "hourly", minute: Number(min) };
  if (!isNum(min) || !isNum(hour) || Number(hour) > 23 || Number(min) > 59) return custom;
  const t = time(hour, min);
  if (dom === "*" && dow === "*") return { kind: "daily", time: t };
  if (dom === "*" && dow === "1-5") return { kind: "weekdays", time: t };
  if (dom === "*" && /^[0-6](,[0-6])*$/.test(dow)) return { kind: "weekly", days: dow.split(",").map(Number), time: t };
  if (isNum(dom) && Number(dom) >= 1 && Number(dom) <= 28 && dow === "*") return { kind: "monthly", day: Number(dom), time: t };
  return custom;
}

/** The set of values a cron field allows, or null when it is malformed. */
function fieldValues(field: string, lo: number, hi: number): Set<number> | null {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
    if (!m) return null;
    const step = m[2] ? Number(m[2]) : 1;
    if (step < 1) return null;
    let a = lo;
    let b = hi;
    if (m[1] !== "*") {
      const [x, y] = m[1].split("-").map(Number);
      a = x;
      b = y ?? (m[2] ? hi : x);
    }
    if (a < lo || b > hi || a > b) return null;
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return out;
}

/**
 * The next `count` times a 5-field cron expression fires after `from`, in the
 * browser's local time (the timezone the builder saves with the schedule).
 * Returns [] for expressions it can't read. Day-of-month and day-of-week
 * combine as in cron: if both are restricted, either one matching is enough.
 */
export function nextRuns(expr: string, from: Date, count = 3): Date[] {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return [];
  const [mins, hours, doms, mons, dows] = [
    fieldValues(parts[0], 0, 59),
    fieldValues(parts[1], 0, 23),
    fieldValues(parts[2], 1, 31),
    fieldValues(parts[3], 1, 12),
    fieldValues(parts[4].replace(/\b7\b/g, "0"), 0, 6),
  ];
  if (!mins || !hours || !doms || !mons || !dows) return [];
  const domAny = parts[2] === "*";
  const dowAny = parts[4] === "*";
  const dayOk = (d: Date) => {
    const a = doms.has(d.getDate());
    const b = dows.has(d.getDay());
    return domAny && dowAny ? true : domAny ? b : dowAny ? a : a || b;
  };

  const out: Date[] = [];
  const t = new Date(from.getTime());
  t.setSeconds(0, 0);
  t.setMinutes(t.getMinutes() + 1);
  // About two years of days: any expression that can fire at all fires within that.
  for (let dayGuard = 0; out.length < count && dayGuard < 800; ) {
    if (!mons.has(t.getMonth() + 1) || !dayOk(t)) {
      t.setDate(t.getDate() + 1);
      t.setHours(0, 0, 0, 0);
      dayGuard++;
      continue;
    }
    if (!hours.has(t.getHours())) {
      t.setHours(t.getHours() + 1, 0, 0, 0);
      if (t.getHours() === 0) dayGuard++;
      continue;
    }
    if (mins.has(t.getMinutes())) out.push(new Date(t.getTime()));
    const before = t.getDate();
    t.setMinutes(t.getMinutes() + 1);
    if (t.getDate() !== before) dayGuard++;
  }
  return out;
}

/** The browser's IANA timezone, e.g. "Asia/Kolkata". */
export const localTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
