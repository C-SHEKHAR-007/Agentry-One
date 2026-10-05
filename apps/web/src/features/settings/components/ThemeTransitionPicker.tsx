import { useState } from "react";
import { cn } from "../../../lib/utils";
import {
  readTransitionPrefs,
  TRANSITION_SPEEDS,
  TRANSITION_STYLES,
  writeTransitionPrefs,
  type TransitionPrefs,
} from "../../shell/themeTransition";

/** How switching the theme animates: style and speed, kept in this browser. */
export function ThemeTransitionPicker() {
  const [prefs, setPrefs] = useState<TransitionPrefs>(readTransitionPrefs);
  const update = (patch: Partial<TransitionPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeTransitionPrefs(next);
  };
  const option = (active: boolean) =>
    cn(
      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
      active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
    );

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <div>
        <p className="text-sm font-medium">Theme switch animation</p>
        <p className="text-xs text-muted-foreground">
          How the new theme appears when you switch. Switch the theme above or with the button in the top bar to see it.
        </p>
      </div>
      <div role="radiogroup" aria-label="Animation style" className="flex flex-wrap gap-2">
        {TRANSITION_STYLES.map((s) => (
          <button key={s.value} type="button" role="radio" aria-checked={prefs.style === s.value} title={s.hint} onClick={() => update({ style: s.value })} className={option(prefs.style === s.value)}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{TRANSITION_STYLES.find((s) => s.value === prefs.style)?.hint}</p>
      {prefs.style !== "off" && (
        <div role="radiogroup" aria-label="Animation speed" className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Speed</span>
          {TRANSITION_SPEEDS.map((ms) => (
            <button key={ms} type="button" role="radio" aria-checked={prefs.durationMs === ms} onClick={() => update({ durationMs: ms })} className={option(prefs.durationMs === ms)}>
              {ms === 500 ? "Fast" : ms === 650 ? "Balanced" : "Slow"} · {ms} ms
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
