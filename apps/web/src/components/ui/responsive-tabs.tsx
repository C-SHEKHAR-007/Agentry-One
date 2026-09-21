import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface TabOption {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: React.ReactNode;
  iconColor?: string;
}

export function ResponsiveTabs({
  tabs,
  activeTab,
  onChange,
  className,
}: {
  tabs: TabOption[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const activeOption = tabs.find((t) => t.id === activeTab) || tabs[0];
  const ActiveIcon = activeOption?.icon;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className={cn("relative w-full sm:w-auto", className)} ref={containerRef}>
      {/* Mobile Custom Dropdown */}
      <div className="block sm:hidden relative w-full">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between h-9 rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm shadow-sm hover:bg-secondary/70 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {ActiveIcon && <ActiveIcon className={cn("h-4 w-4 shrink-0", activeOption.iconColor)} />}
            <span className="font-medium truncate">{activeOption?.label}</span>
            {activeOption?.count !== undefined && (
              <span className="text-[10px] text-muted-foreground shrink-0">({activeOption.count})</span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </button>

        {open && (
          <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95">
            <div className="py-1 max-h-[300px] overflow-y-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onChange(tab.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                      activeTab === tab.id && "bg-accent text-accent-foreground"
                    )}
                  >
                    {Icon && <Icon className={cn("h-4 w-4 shrink-0", tab.iconColor)} />}
                    <span className="truncate">{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">({tab.count})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Pills */}
      <div className="hidden sm:flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border/40 text-xs w-full sm:w-auto overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/70 border border-transparent"
              )}
            >
              {Icon && <Icon className={cn("h-3.5 w-3.5", tab.iconColor)} />}
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 text-[10px] text-muted-foreground">({tab.count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
