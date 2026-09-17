import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (side === "right") {
      setCoords({
        left: rect.right + 12,
        top: rect.top + rect.height / 2,
      });
    } else if (side === "top") {
      setCoords({
        left: rect.left + rect.width / 2,
        top: rect.top - 8,
      });
    } else {
      setCoords({
        left: rect.left + rect.width / 2,
        top: rect.bottom + 8,
      });
    }
  };

  const handleOpen = () => {
    updateCoords();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handleReposition = () => updateCoords();
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open]);

  return (
    <div
      ref={triggerRef}
      className={cn("relative flex items-center justify-center", className)}
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
    >
      {children}
      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: side === "right" ? "translateY(-50%)" : "translateX(-50%)",
            }}
            className="pointer-events-none z-[9999] whitespace-nowrap rounded-md border border-border/80 bg-popover/95 px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-xl backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {label}
          </div>,
          document.body,
        )}
    </div>
  );
}
