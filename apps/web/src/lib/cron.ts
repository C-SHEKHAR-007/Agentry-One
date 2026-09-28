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
