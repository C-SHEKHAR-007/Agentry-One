import { NavLink, useLocation } from "react-router-dom";
import { Sparkles, ChevronsLeft, ChevronsRight, ChevronDown, Zap } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Tooltip } from "../ui/tooltip";
import { NAV_SECTIONS, NAV_FOOTER, type NavItem } from "./nav";

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
  const base =
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 w-full min-w-0";
  const Icon = item.icon;

  if (!item.to) {
    const node = (
      <div
        aria-disabled
        className={cn(base, "cursor-default text-muted-foreground/40 select-none")}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            {item.badge && (
              <Badge
                variant={item.badge === "New" ? "default" : "outline"}
                className="ml-auto px-1.5 py-0 text-[10px]"
              >
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </div>
    );
    return collapsed ? <Tooltip label={`${item.label} (soon)`}>{node}</Tooltip> : node;
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
        base,
        isActive
          ? "bg-primary/20 text-primary font-medium shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]")} />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <Badge variant="default" className="ml-auto px-1.5 py-0 text-[10px]">
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </NavLink>
  );
  return collapsed ? <Tooltip label={item.label}>{node}</Tooltip> : node;
}

export function SidebarContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn("flex items-center gap-2.5 px-4 py-4", collapsed && "justify-center px-2")}>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <Sparkles className="h-4 w-4" />
        </span>
        {!collapsed && (
          <span className="text-base font-bold tracking-tight">Agentry</span>
        )}
      </div>

      {/* Workspace selector */}
      {!collapsed && (
        <div className="mx-3 mb-3">
          <button className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-white/5 px-3 py-2 transition-colors hover:bg-white/8">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary/30 text-xs font-bold text-primary">
                P
              </span>
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground">Workspace</p>
                <p className="text-xs font-medium truncate max-w-[120px]">Personal Workspace</p>
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i} className="mt-2 first:mt-0">
            {section.label && !collapsed && (
              <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                {section.label}
              </p>
            )}
            <div className="grid gap-0.5">
              {section.items.map((item) => (
                <NavEntry key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer nav */}
      <div className="border-t border-border/60 px-2 py-2">
        <div className="grid gap-0.5">
          {NAV_FOOTER.map((item) => (
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
              <p className="text-[10px] text-muted-foreground">v1.0.0</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r border-border/60 bg-card/80 backdrop-blur transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-[64px]" : "w-60",
      )}
    >
      <SidebarContent collapsed={collapsed} />
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-16 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground hover:bg-secondary"
      >
        {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
      </button>
    </aside>
  );
}
