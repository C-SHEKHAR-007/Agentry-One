import { useState } from "react";
import { cn } from "../../lib/utils";

// Minimal hover/focus tooltip -- only used for collapsed-sidebar icon labels,
// so no collision detection or portal is needed.
export function Tooltip({
  label,
  side = "right",
  children,
  className,
}: {
  label: string;
  side?: "right" | "top" | "bottom";
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pos =
    side === "right"
      ? "left-full top-1/2 -translate-y-1/2 ml-2"
      : side === "top"
        ? "bottom-full left-1/2 -translate-x-1/2 mb-2"
        : "top-full left-1/2 -translate-x-1/2 mt-2";
  return (
    <div
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-50 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md",
            pos,
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
