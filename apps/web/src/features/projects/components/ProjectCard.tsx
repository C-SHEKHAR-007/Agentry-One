import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Project, ProjectActivity } from "../../../models";
import { routes } from "../../../services/api/routes";
import { formatPercent, timeAgo } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { Sparkline } from "../../../components/ui/sparkline";

/** For an API that predates activity stats (e.g. during a rolling update). */
export const NO_ACTIVITY: ProjectActivity = { runs30d: 0, completed30d: 0, failed30d: 0, successRate: null, daily: [] };

/** Two-letter monogram for a project with no image yet. */
export const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

/** A stable hue per project, so a cover without an image still tells projects apart. */
export const hueOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** A project in the grid: its latest image (or a monogram cover), 30-day runs and success rate. */
export function ProjectCard({ project: p, index }: { project: Project; index: number }) {
  const a = p.activity ?? NO_ACTIVITY;
  const cover = p.coverPreviewUrl ?? (p.coverArtifactId ? routes.files.download(p.coverArtifactId) : null);
  const hue = hueOf(p.id);
  const rateTone = a.successRate == null ? "text-muted-foreground" : a.successRate >= 0.9 ? "text-success" : a.successRate >= 0.6 ? "text-warning" : "text-destructive";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
      <Link to={`/projects/${p.id}`} className="group block overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50">
        <div className="relative h-32 overflow-hidden">
          {cover ? (
            <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55% / 0.35), hsl(${(hue + 60) % 360} 70% 45% / 0.15))` }}
            >
              <span className="text-3xl font-semibold tracking-tight text-foreground/70">{monogram(p.name)}</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-card/95 to-transparent px-3 pb-1 pt-6">
            <Sparkline values={a.daily} width={260} height={28} />
          </div>
        </div>
        <div className="p-4">
          <p className="truncate text-sm font-semibold group-hover:text-primary">{p.name}</p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Runs · 30d</dt>
              <dd className="font-medium tabular-nums">{a.runs30d}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Success</dt>
              <dd className={cn("font-medium tabular-nums", rateTone)}>{formatPercent(a.successRate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Artifacts</dt>
              <dd className="font-medium tabular-nums">{p.counts.artifacts}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground/70">
            {p.counts.templates} workflow{p.counts.templates === 1 ? "" : "s"} · {p.lastActivityAt ? `active ${timeAgo(p.lastActivityAt)}` : `created ${timeAgo(p.createdAt)}`}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
