import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Sidebar, SidebarContent } from "./shell/Sidebar";
import { Topbar } from "./shell/Topbar";
import { CommandPalette } from "./shell/CommandPalette";
import { DialogOverlay, DialogPortal } from "./ui/dialog";

const SIDEBAR_COLLAPSED_KEY = "agentry-sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "agentry-sidebar-width";
const SIDEBAR_LAST_WIDTH_KEY = "agentry-sidebar-last-width";
const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 190;
const MAX_SIDEBAR_WIDTH = 400;

export function Layout() {
  const [collapsed, setCollapsed] = useState(() => {
    const val = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (val !== null) return val === "true";
    return localStorage.getItem("agentry-sidebar") === "collapsed";
  });

  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = saved ? parseInt(saved, 10) : DEFAULT_SIDEBAR_WIDTH;
    return isNaN(parsed) ? DEFAULT_SIDEBAR_WIDTH : Math.min(Math.max(parsed, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
  });

  const [lastExpandedWidth, setLastExpandedWidth] = useState<number>(() => {
    const saved = localStorage.getItem(SIDEBAR_LAST_WIDTH_KEY) || localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = saved ? parseInt(saved, 10) : DEFAULT_SIDEBAR_WIDTH;
    return isNaN(parsed) ? DEFAULT_SIDEBAR_WIDTH : Math.min(Math.max(parsed, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  }, [width]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_LAST_WIDTH_KEY, String(lastExpandedWidth));
  }, [lastExpandedWidth]);

  const handleToggle = () => {
    if (collapsed) {
      // Expanding: restore the previous width before collapse
      const targetWidth = lastExpandedWidth >= MIN_SIDEBAR_WIDTH ? lastExpandedWidth : DEFAULT_SIDEBAR_WIDTH;
      setWidth(targetWidth);
      setCollapsed(false);
    } else {
      // Collapsing: remember current width before collapse
      setLastExpandedWidth(width);
      setCollapsed(true);
    }
  };

  const handleResize = (newWidth: number) => {
    const clamped = Math.min(Math.max(newWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
    setWidth(clamped);
    setLastExpandedWidth(clamped);
  };

  const handleResetWidth = () => {
    setWidth(DEFAULT_SIDEBAR_WIDTH);
    setLastExpandedWidth(DEFAULT_SIDEBAR_WIDTH);
  };

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={handleToggle}
        width={width}
        onResize={handleResize}
        onResetWidth={handleResetWidth}
        minWidth={MIN_SIDEBAR_WIDTH}
        maxWidth={MAX_SIDEBAR_WIDTH}
      />

      {/* Mobile drawer: radix Dialog gives focus trap, ESC, scroll lock. */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPortal>
          <DialogOverlay className="md:hidden" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card shadow-xl focus:outline-none data-[state=open]:animate-fade-in md:hidden"
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <Topbar
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main className="w-full flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
