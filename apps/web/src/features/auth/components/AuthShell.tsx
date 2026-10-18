import { Activity, GitBranch, ShieldCheck, Sparkles } from "lucide-react";
import { OrchestrationScene } from "../../../components/common/three/OrchestrationScene";
import { Card } from "../../../components/ui/card";

const POINTS = [
  { icon: GitBranch, title: "Compose agents into workflows", text: "Steps run in parallel as soon as their inputs are ready." },
  { icon: Activity, title: "Watch every run live", text: "Status, logs, tokens and cost for each step as it happens." },
  { icon: ShieldCheck, title: "Your models, your keys", text: "Local models by default; hosted providers when you choose." },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="text-base font-bold tracking-tight">Agentry</span>
    </div>
  );
}

/**
 * Sign-in / setup layout. Large screens: two equal halves, the product story
 * (orchestration core, headline, three points) centred on the left and the form
 * centred on the right. Small screens: the brand above the form.
 */
export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  /** Under the card, e.g. who to ask for an account. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="app-backdrop" aria-hidden="true">
        <div className="grid-layer" />
      </div>

      <aside className="relative z-10 hidden flex-col overflow-hidden border-r border-border/50 p-10 lg:flex xl:p-12">
        <Brand />
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-8">
          <div className="relative h-[34vh] max-h-[340px] min-h-[220px]">
            <OrchestrationScene activity={4} nodes={8} className="h-full w-full" />
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">AI orchestration platform</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight xl:text-3xl">Run AI agents like infrastructure.</h2>
          <ul className="mt-6 space-y-4">
            {POINTS.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{t}</span>
                  <span className="block text-xs text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Self-hosted · your data and keys stay on your servers.</p>
      </aside>

      <main className="relative z-10 flex min-h-screen flex-col px-4 py-8 sm:px-6">
        <div className="lg:hidden">
          <Brand />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-sm">
            <Card glass className="glow-border border-transparent p-6 sm:p-8">
              <div className="mb-6 text-center">
                <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
              </div>
              {children}
            </Card>
            {footer && <div className="mt-6 text-center text-xs text-muted-foreground">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
