import { lazy, Suspense, useMemo } from "react";
import { cn } from "../../../lib/utils";

// three.js is ~150 KB gzipped: load it only where the scene is shown.
const OrchestrationCore = lazy(() => import("./OrchestrationCore"));

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

/** CSS stand-in (no WebGL, or while three.js loads): a glowing orb with two
 * orbit rings. */
function FallbackOrb() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="absolute h-40 w-40 rounded-full bg-primary/25 blur-3xl" />
      <div className="absolute h-56 w-56 rounded-full border border-primary/20 [transform:rotateX(70deg)]" />
      <div className="absolute h-72 w-72 rounded-full border border-info/15 [transform:rotateX(64deg)_rotateY(18deg)]" />
      <div className="relative h-16 w-16 animate-float rounded-2xl border border-primary/50 bg-primary/10 shadow-[0_0_40px_hsl(var(--primary)/0.45)] [transform:rotate(45deg)]" />
    </div>
  );
}

export function OrchestrationScene({ activity, nodes, className }: { activity?: number; nodes?: number; className?: string }) {
  const supported = useMemo(webglAvailable, []);
  return (
    <div className={cn("relative", className)}>
      {supported ? (
        <Suspense fallback={<FallbackOrb />}>
          <OrchestrationCore activity={activity} nodes={nodes} className="absolute inset-0" />
        </Suspense>
      ) : (
        <FallbackOrb />
      )}
    </div>
  );
}
