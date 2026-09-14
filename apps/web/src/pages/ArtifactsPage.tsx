import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  Headphones,
  Images,
  Clock,
  X,
  Eye,
  Check,
  Copy,
  Video as VideoIcon,
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
  const isAudio = artifact.mimeType.startsWith("audio/");
  const isVideo = artifact.mimeType.startsWith("video/");
  const isText =
    artifact.mimeType.startsWith("text/") ||
    artifact.mimeType.includes("json") ||
    artifact.kind === "text" ||
    artifact.kind === "search_brief";

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
        ) : isAudio ? (
          <div className="p-6 bg-secondary/15 flex flex-col items-center justify-center gap-2 text-center min-h-[120px]">
            <span className="p-3 rounded-full bg-primary/10 text-primary">
              <Headphones className="h-6 w-6" />
            </span>
            <span className="text-xs font-medium text-foreground">Audio Recording</span>
            <span className="text-[10px] text-muted-foreground">{artifact.mimeType}</span>
          </div>
        ) : isText ? (
          <div className="p-5 bg-secondary/10 flex flex-col justify-between min-h-[120px]">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {artifact.kind}
              </span>
            </div>
            <p className="mt-2 text-xs font-mono text-foreground/80 line-clamp-3 bg-background/50 p-2 rounded border border-border/40">
              {artifact.metadata?.preview || "Click to view full text output & copy..."}
            </p>
          </div>
        ) : isVideo ? (
          <div className="p-6 bg-secondary/15 flex flex-col items-center justify-center gap-2 text-center min-h-[120px]">
            <span className="p-3 rounded-full bg-primary/10 text-primary">
              <VideoIcon className="h-6 w-6" />
            </span>
            <span className="text-xs font-medium text-foreground">Video Render</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-6">
            <FileArchive className="h-6 w-6 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{artifact.kind}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/40">
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
  const [copied, setCopied] = useState(false);
  const isImage = artifact?.mimeType.startsWith("image/") ?? false;
  const isAudio = artifact?.mimeType.startsWith("audio/") ?? false;
  const isVideo = artifact?.mimeType.startsWith("video/") ?? false;
  const isText =
    artifact &&
    (artifact.mimeType.startsWith("text/") ||
      artifact.mimeType.includes("json") ||
      artifact.kind === "text" ||
      artifact.kind === "search_brief");

  const { data: previewSas } = useSasPreviewUrl(!artifact?.previewUrl ? artifact?.id : undefined);
  const { data: downloadSas } = useSasDownloadUrl(!artifact?.downloadUrl ? artifact?.id : undefined);
  const previewUrl = artifact?.previewUrl || previewSas?.url;
  const downloadUrl = artifact?.downloadUrl || downloadSas?.url;
  const expiresAt = previewSas?.expiresAt;

  // Text content loader
  const { data: textContent, isLoading: textLoading } = useQuery({
    queryKey: ["preview-artifact-text", artifact?.id],
    queryFn: async () => {
      const targetUrl = downloadUrl || previewUrl;
      if (!targetUrl) return "";
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error("Could not fetch artifact content");
      return res.text();
    },
    enabled: Boolean(isText && (downloadUrl || previewUrl)),
    staleTime: 5 * 60 * 1000,
  });

  const handleCopy = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

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
            <div className="max-h-[70vh] overflow-y-auto">
              {isImage ? (
                previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={artifact.kind}
                    className="w-full object-contain max-h-[65vh]"
                  />
                ) : (
                  <Skeleton className="aspect-video w-full" />
                )
              ) : isAudio ? (
                <div className="p-8 space-y-4 text-center bg-secondary/10">
                  <div className="flex justify-center">
                    <span className="p-4 rounded-full bg-primary/20 text-primary">
                      <Headphones className="h-8 w-8" />
                    </span>
                  </div>
                  <h4 className="font-semibold text-base capitalize">{artifact.kind}</h4>
                  <audio controls src={previewUrl || downloadUrl} className="w-full max-w-md mx-auto" autoPlay />
                </div>
              ) : isVideo ? (
                <div className="p-4 bg-black">
                  <video controls src={previewUrl || downloadUrl} className="w-full rounded-lg max-h-[60vh]" autoPlay />
                </div>
              ) : isText ? (
                <div className="p-6 bg-secondary/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Document Content
                    </span>
                    {textContent && (
                      <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleCopy}>
                        {copied ? <Check className="h-3.5 w-3.5 mr-1 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                        {copied ? "Copied" : "Copy Text"}
                      </Button>
                    )}
                  </div>
                  {textLoading ? (
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ) : textContent ? (
                    <pre className="p-4 rounded-lg bg-background/80 border border-border font-mono text-xs whitespace-pre-wrap break-words leading-relaxed max-h-[50vh] overflow-y-auto">
                      {textContent}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground py-4">Unable to display text preview.</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-14">
                  <FileArchive className="h-10 w-10 text-muted-foreground" />
                  <span className="text-lg font-medium">{artifact.kind}</span>
                </div>
              )}
            </div>

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
