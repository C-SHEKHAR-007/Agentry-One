import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Sidebar, SidebarContent } from "./shell/Sidebar";
import { Topbar } from "./shell/Topbar";
import { CommandPalette } from "./shell/CommandPalette";
import { DialogOverlay, DialogPortal } from "./ui/dialog";

const SIDEBAR_KEY = "agentry-sidebar";

export function Layout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "open");
  }, [collapsed]);

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
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

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

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
