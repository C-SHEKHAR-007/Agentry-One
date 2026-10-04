import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Spinner } from "../../../components/ui/spinner";
import { ErrorBoundary } from "../../../components/common/ErrorBoundary";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Sidebar, SidebarContent } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { DialogOverlay, DialogPortal } from "../../../components/ui/dialog";
import { useLiveActivity } from "../hooks/useLiveActivity";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import {
  resetSidebarWidth,
  resizeSidebar,
  setMobileNavOpen,
  setPaletteOpen as setPaletteOpenAction,
  SIDEBAR,
  togglePalette,
  toggleSidebar,
} from "../ui.slice";

export function Layout() {
  const dispatch = useAppDispatch();
  const { collapsed, width } = useAppSelector((st) => st.ui.sidebar);
  const mobileOpen = useAppSelector((st) => st.ui.mobileNavOpen);
  const paletteOpen = useAppSelector((st) => st.ui.paletteOpen);
  const setMobileOpen = (open: boolean) => dispatch(setMobileNavOpen(open));
  const setPaletteOpen = (open: boolean) => dispatch(setPaletteOpenAction(open));
  const location = useLocation();
  // Layout only renders for signed-in users (routes are behind RequireAuth).
  useLiveActivity(true);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    dispatch(setMobileNavOpen(false));
  }, [location.pathname, location.search, dispatch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dispatch(togglePalette());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  return (
    <div className="relative flex h-screen overflow-hidden">
      <div className="app-backdrop" aria-hidden="true">
        <div className="grid-layer" />
      </div>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => dispatch(toggleSidebar())}
        width={width}
        onResize={(w) => dispatch(resizeSidebar(w))}
        onResetWidth={() => dispatch(resetSidebarWidth())}
        minWidth={SIDEBAR.min}
        maxWidth={SIDEBAR.max}
      />

      {/* Mobile drawer: radix Dialog gives focus trap, ESC, scroll lock. */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPortal>
          <DialogOverlay className="md:hidden" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card shadow-xl focus:outline-none data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out md:hidden"
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogPrimitive.Root>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <Topbar
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main className="w-full flex-1 overflow-y-auto p-4 md:p-8">
          <ErrorBoundary key={location.pathname}>
            <Suspense
              fallback={
                <div className="flex justify-center py-16">
                  <Spinner className="h-6 w-6 text-primary" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
