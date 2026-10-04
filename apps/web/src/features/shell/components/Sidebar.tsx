import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, Sparkles, Zap } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Badge } from "../../../components/ui/badge";
import { Tooltip } from "../../../components/ui/tooltip";
import { NAV_SECTIONS, NAV_FOOTER, type NavItem } from "../nav";
import { useAuth } from "../../auth/useAuth";

function NavEntry({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const Icon = item.icon;

  if (!item.to) {
    const node = (
      <div
        aria-disabled
        className={cn(
          "flex items-center rounded-lg transition-all duration-150 cursor-default text-muted-foreground/40 select-none",
          collapsed
            ? "h-9 w-9 justify-center p-0"
            : "w-full gap-3 px-2.5 py-2 text-sm",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            {item.badge && (
              <Badge
                variant={item.badge === "New" ? "default" : "outline"}
                className="ml-auto px-1.5 py-0 text-[11px]"
              >
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </div>
    );
    return collapsed ? (
      <Tooltip label={`${item.label} (soon)`} className="w-full flex justify-center">
        {node}
      </Tooltip>
    ) : (
      node
    );
  }

  const [pathname, search] = item.to.split("?");
  const pathMatches = item.end
    ? location.pathname === pathname
    : location.pathname === pathname || location.pathname.startsWith(pathname + "/");
  const searchMatches = search ? location.search === `?${search}` : item.end ? location.search === "" : true;
  const isActive = pathMatches && searchMatches;

  const node = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "flex items-center rounded-lg transition-all duration-150",
        collapsed
          ? "h-9 w-9 justify-center p-0"
          : "w-full gap-3 px-2.5 py-2 text-sm",
        isActive
          ? "bg-primary/20 text-primary font-medium shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]")} />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <Badge variant="default" className="ml-auto px-1.5 py-0 text-[11px]">
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip label={item.label} className="w-full flex justify-center">
      {node}
    </Tooltip>
  ) : (
    node
  );
}

export function SidebarContent({
  collapsed = false,
  onNavigate,
  onToggle,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Collapse/expand; omitted in the mobile drawer (it closes instead). */
  onToggle?: () => void;
}) {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isOwner || item.label !== "Team"),
  }));

  return (
    <div className="flex h-full flex-col">
      {/* Logo + collapse toggle. Collapsed: the logo turns into the expand
          button while the pointer is over the sidebar (or it has focus).
          Expanded: the collapse button sits right of the app name. */}
      <div
        className={cn(
          "flex items-center gap-3 py-4",
          collapsed ? "justify-center px-0" : "px-3",
        )}
      >
        {collapsed && onToggle ? (
          <Tooltip label="Expand sidebar">
            <button
              type="button"
              onClick={onToggle}
              aria-label="Expand sidebar"
              className="group/toggle relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="absolute inset-0 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-200 group-hover/sidebar:scale-75 group-hover/sidebar:opacity-0 group-focus-visible/toggle:scale-75 group-focus-visible/toggle:opacity-0">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="absolute inset-0 inline-flex scale-75 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all duration-200 hover:bg-muted hover:text-foreground group-hover/sidebar:scale-100 group-hover/sidebar:opacity-100 group-focus-visible/toggle:scale-100 group-focus-visible/toggle:opacity-100">
                <PanelLeftOpen className="h-[18px] w-[18px]" />
              </span>
            </button>
          </Tooltip>
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30 shrink-0">
            <Sparkles className="h-4 w-4" />
          </span>
        )}
        {!collapsed && (
          <span className="text-base font-bold tracking-tight">Agentry</span>
        )}
        {!collapsed && onToggle && (
          <Tooltip label="Collapse sidebar" side="bottom" className="ml-auto">
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PanelLeftClose className="h-[18px] w-[18px]" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden pb-2 scrollbar-thin", collapsed ? "px-0" : "px-3")}>
        {visibleSections.map((section, i) => (
          <div key={i} className="mt-2 first:mt-0">
            {section.label && !collapsed && (
              <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                {section.label}
              </p>
            )}
            {collapsed && i > 0 && (
              <div className="mx-auto my-2 h-px w-6 bg-border/40" />
            )}
            <div className={cn("grid gap-0.5", collapsed && "justify-items-center gap-1.5")}>
              {section.items.map((item) => (
                <NavEntry key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer nav */}
      <div className={cn("border-t border-border/60 py-2", collapsed ? "px-0" : "px-3")}>
        <div className={cn("grid gap-0.5", collapsed && "justify-items-center gap-1.5")}>
          {NAV_FOOTER.filter((item) => isOwner || item.label !== "Team").map((item) => (
            <NavEntry key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* Enterprise badge */}
      {!collapsed && (
        <div className="mx-3 mb-3 mt-1">
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2">
            <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-primary">Enterprise Edition</p>
              <p className="text-[11px] text-muted-foreground">v1.0.0</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  width?: number;
  onResize?: (width: number) => void;
  onResetWidth?: () => void;
  minWidth?: number;
  maxWidth?: number;
}

export function Sidebar({
  collapsed,
  onToggle,
  width = 240,
  onResize,
  onResetWidth,
  minWidth = 190,
  maxWidth = 400,
}: SidebarProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = collapsed ? 64 : width;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;

      if (newWidth < 120) {
        if (!collapsed) {
          onToggle();
        }
      } else {
        if (collapsed) {
          onToggle();
        }
        if (onResize) {
          const clamped = Math.min(Math.max(newWidth, minWidth), maxWidth);
          onResize(clamped);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDoubleClick = () => {
    if (onResetWidth) {
      onResetWidth();
    }
  };

  return (
    <aside
      style={{ width: collapsed ? 64 : width }}
      className={cn(
        "hidden h-full shrink-0 border-r border-border/60 bg-card/80 backdrop-blur md:flex md:flex-col relative group/sidebar",
        isDragging ? "transition-none select-none" : "transition-[width] duration-200",
      )}
    >
      <SidebarContent collapsed={collapsed} onToggle={onToggle} />


      {/* Resizable edge handle (pick & move) */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title="Drag to resize sidebar (double-click to reset)"
        className={cn(
          "absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-20 flex items-center justify-center select-none transition-colors",
          "hover:bg-primary/10",
          isDragging && "bg-primary/20",
        )}
      >
        {/* Subtle pill indicator that glows on hover or drag */}
        <div
          className={cn(
            "h-8 w-1 rounded-full bg-border/40 transition-all duration-150 group-hover/sidebar:bg-border/80",
            "hover:!bg-primary hover:!h-12",
            isDragging && "!bg-primary !h-16 !w-1.5 shadow-sm shadow-primary/40",
          )}
        />
      </div>
    </aside>
  );
}
