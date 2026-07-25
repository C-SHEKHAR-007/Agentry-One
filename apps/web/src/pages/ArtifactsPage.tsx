import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  ExternalLink,
  FileArchive,
  Images,
  Clock,
  X,
  Eye,
} from "lucide-react";
import { useArtifacts, useProjects, useSasPreviewUrl, useSasDownloadUrl } from "../api/queries";
import type { ArtifactListItem } from "../api/types";
import { formatBytes, timeAgo } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";

// ── Per-card component so each hook call is at the top level ──────────────────
function ArtifactCard({
  artifact,
  index,
  onPreview,
}: {
  artifact: ArtifactListItem;
  index: number;
  onPreview: (a: ArtifactListItem) => void;
}) {
  const isImage = artifact.mimeType.startsWith("image/");
  const { data: sas } = useSasPreviewUrl(!artifact.previewUrl && isImage ? artifact.id : undefined);
  const url = artifact.previewUrl || sas?.url;

  return (
    <motion.div
      key={artifact.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.5) }}
      className="break-inside-avoid"
    >
      <button
        onClick={() => onPreview(artifact)}
        className="group block w-full overflow-hidden rounded-xl border border-border bg-card text-left transition-all duration-200 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5"
      >
        {isImage ? (
          url ? (
            <div className="relative overflow-hidden">
              <img
                src={url}
                alt={artifact.kind}
                loading="lazy"
                className="w-full transition-transform duration-300 group-hover:scale-[1.03]"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/20 flex items-center justify-center">
                <Eye className="h-6 w-6 text-white opacity-0 drop-shadow group-hover:opacity-100 transition-opacity duration-200" />
              </div>
            </div>
          ) : (
            <Skeleton className="aspect-square w-full" />
          )
        ) : (
          <div className="flex items-center gap-3 p-6">
            <FileArchive className="h-6 w-6 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{artifact.kind}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2">
          <p className="truncate text-xs text-muted-foreground">
            {artifact.projectName} · {timeAgo(artifact.createdAt)}
          </p>
          <Badge variant="outline" className="ml-2 shrink-0 text-[10px] capitalize">
            {artifact.kind}
          </Badge>
        </div>
      </button>
    </motion.div>
  );
}

// ── Preview dialog — loads SAS download URL lazily when dialog opens ──────────
function PreviewDialog({
  artifact,
  onClose,
}: {
  artifact: ArtifactListItem | null;
  onClose: () => void;
}) {
  const isImage = artifact?.mimeType.startsWith("image/") ?? false;
  const { data: previewSas } = useSasPreviewUrl(!artifact?.previewUrl ? artifact?.id : undefined);
  const { data: downloadSas } = useSasDownloadUrl(!artifact?.downloadUrl ? artifact?.id : undefined);
  const previewUrl = artifact?.previewUrl || previewSas?.url;
  const downloadUrl = artifact?.downloadUrl || downloadSas?.url;
  const expiresAt = previewSas?.expiresAt;

  return (
    <Dialog open={!!artifact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        {artifact && (
          <>
            <DialogTitle className="sr-only">Artifact preview — {artifact.kind}</DialogTitle>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              <X className="h-4 w-4" />
            </button>
            {/* Preview area */}
            {isImage ? (
              previewUrl ? (
                <img
                  src={previewUrl}
                  alt={artifact.kind}
                  className="w-full"
                />
              ) : (
                <Skeleton className="aspect-video w-full" />
              )
            ) : (
              <div className="flex items-center gap-3 p-14">
                <FileArchive className="h-10 w-10 text-muted-foreground" />
                <span className="text-lg font-medium">{artifact.kind}</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/80 px-5 py-4 backdrop-blur-sm">
              <div className="min-w-0">
                <p className="truncate font-medium capitalize">{artifact.kind}</p>
                <p className="text-xs text-muted-foreground">
                  {artifact.mimeType}
                  {artifact.sizeBytes ? ` · ${formatBytes(artifact.sizeBytes)}` : ""}
                  {" · "}
                  {timeAgo(artifact.createdAt)}
                </p>
                {expiresAt && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/70">
                    <Clock className="h-3 w-3" />
                    Link expires {timeAgo(expiresAt)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Link to={`/workflows/${artifact.workflowId}`}>
                  <Button variant="secondary" size="sm">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open workflow
                  </Button>
                </Link>
                {downloadUrl ? (
                  <a href={downloadUrl} target="_blank" rel="noreferrer" download>
                    <Button size="sm">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </a>
                ) : (
                  <Button size="sm" disabled>
                    <Download className="h-3.5 w-3.5" />
                    Loading…
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function ArtifactsPage() {
  const [projectId, setProjectId] = useState("");
  const [kind, setKind] = useState("");
  const [preview, setPreview] = useState<ArtifactListItem | null>(null);

  const { data: projects } = useProjects();
  const { data: artifacts, isLoading } = useArtifacts({
    limit: 60,
    projectId: projectId || undefined,
    kind: kind || undefined,
  });

  const kinds = useMemo(
    () => [...new Set((artifacts ?? []).map((a) => a.kind))],
    [artifacts],
  );

  return (
    <div>
      <PageHeader
        title="Artifacts"
        description="Everything your agents have produced — stored, checksummed, and accessible via expiring SAS links."
        actions={
          <>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-40">
              <option value="">All projects</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-36">
              <option value="">All kinds</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </>
        }
      />

      {isLoading && (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 break-inside-avoid rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && artifacts?.length === 0 && (
        <EmptyState
          icon={Images}
          title="No artifacts yet"
          description="Run an agent and its outputs will collect here."
        />
      )}

      <AnimatePresence>
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
          {artifacts?.map((a, i) => (
            <ArtifactCard
              key={a.id}
              artifact={a}
              index={i}
              onPreview={setPreview}
            />
          ))}
        </div>
      </AnimatePresence>

      <PreviewDialog artifact={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
