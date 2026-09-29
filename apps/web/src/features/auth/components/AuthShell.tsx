import { Activity, GitBranch, ShieldCheck, Sparkles } from "lucide-react";
import { OrchestrationScene } from "../../../components/common/three/OrchestrationScene";

const POINTS = [
  { icon: GitBranch, title: "Compose agents into workflows", text: "Steps run in parallel as soon as their inputs are ready." },
  { icon: Activity, title: "Watch every run live", text: "Status, logs, tokens and cost for each step as it happens." },
  { icon: ShieldCheck, title: "Your models, your keys", text: "Local models by default; hosted providers when you choose." },
];

/** Sign-in / setup layout: the orchestration core and product story on the
 * left (large screens), the form on the right. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen">
      <div className="app-backdrop" aria-hidden="true">
        <div className="grid-layer" />
      </div>
      <aside className="relative z-10 hidden flex-1 flex-col justify-between overflow-hidden border-r border-border/50 p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-base font-bold tracking-tight">Agentry</span>
        </div>
        <div className="relative -mx-10 h-[46vh] min-h-[300px]">
          <OrchestrationScene activity={4} nodes={8} className="h-full w-full" />
        </div>
        <div className="max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">AI orchestration platform</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Run AI agents like infrastructure.</h2>
          <ul className="mt-6 space-y-4">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block text-xs text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="relative z-10 flex flex-1 items-center justify-center p-4 lg:max-w-xl">{children}</main>
    </div>
  );
}
