/** A readable, collapsible view of JSON output. Objects and arrays fold
 * with native <details> (keyboard accessible); the top levels start open. */
export function JsonView({ value }: { value: unknown }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background/80 p-3 font-mono text-xs leading-relaxed">
      <Node value={value} depth={0} />
    </div>
  );
}

function Node({ value, depth, name }: { value: unknown; depth: number; name?: string }) {
  const label = name !== undefined ? <span className="text-primary">{JSON.stringify(name)}: </span> : null;
  if (value === null || typeof value !== "object") {
    const tone =
      typeof value === "string" ? "text-success" : typeof value === "number" ? "text-chart-3" : "text-warning";
    return (
      <div className="whitespace-pre-wrap break-words">
        {label}
        <span className={tone}>{JSON.stringify(value)}</span>
      </div>
    );
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
  const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  if (entries.length === 0) {
    return (
      <div>
        {label}
        <span className="text-muted-foreground">{open + close}</span>
      </div>
    );
  }
  return (
    <details open={depth < 2}>
      <summary className="cursor-pointer select-none list-none text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        {label}
        {open}
        <span className="mx-1 text-[11px]">
          {entries.length} {Array.isArray(value) ? (entries.length === 1 ? "item" : "items") : entries.length === 1 ? "key" : "keys"}
        </span>
      </summary>
      <div className="border-l border-border/70 pl-4">
        {entries.map(([k, v]) => (
          <Node key={k} value={v} depth={depth + 1} name={Array.isArray(value) ? undefined : k} />
        ))}
      </div>
      <div className="text-muted-foreground">{close}</div>
    </details>
  );
}
