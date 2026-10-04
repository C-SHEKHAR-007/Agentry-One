import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, FileArchive, Headphones, X } from "lucide-react";
import { useArtifactDownloadUrlQuery, useArtifactPreviewUrlQuery, useArtifactTextQuery } from "../artifacts.api";
import type { ArtifactListItem } from "../../../models";
import { formatBytes, timeAgo } from "../../../lib/format";
import { TextBody } from "../../../components/common/TextBody";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "../../../components/ui/dialog";
import { Skeleton } from "../../../components/ui/skeleton";
import { Spinner } from "../../../components/ui/spinner";
import { isTextArtifact } from "./ArtifactCard";

/** Full-screen viewer for the gallery: the artifact at `index`, with ← / →
 * (buttons or arrow keys) to step through the filtered list. Stepping past
 * the last loaded artifact loads the next page. */
export function ArtifactViewer({
  artifacts,
  index,
  onIndex,
  onClose,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  artifacts: ArtifactListItem[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => Promise<unknown>;
}) {
  const artifact = index === null ? null : (artifacts[index] ?? null);
  const canPrev = index !== null && index > 0;
  const canNext = index !== null && (index < artifacts.length - 1 || hasMore);

  const prev = () => canPrev && onIndex(index! - 1);
  const next = () => {
    if (index === null || !canNext) return;
    if (index < artifacts.length - 1) onIndex(index + 1);
    else void onLoadMore().then(() => onIndex(index + 1));
  };

  useEffect(() => {
    if (!artifact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, audio, video")) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Dialog open={Boolean(artifact)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose aria-describedby={undefined} className="flex h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        {artifact && (
          <>
            <DialogTitle className="sr-only">
              {artifact.kind} from {artifact.projectName}
            </DialogTitle>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold capitalize">{artifact.kind}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {artifact.projectName} · {artifact.agentId} · {timeAgo(artifact.createdAt)}
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {index! + 1} / {artifacts.length}
                {hasMore ? "+" : ""}
              </span>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={prev} disabled={!canPrev} aria-label="Previous artifact">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={next} disabled={!canNext || loadingMore} aria-label="Next artifact">
                {loadingMore ? <Spinner className="h-3.5 w-3.5" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close viewer">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {/* Keyed so each artifact starts with fresh state (copy, media). */}
            <ArtifactBody key={artifact.id} artifact={artifact} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ArtifactBody({ artifact }: { artifact: ArtifactListItem }) {
  const [copied, setCopied] = useState(false);
  const isImage = artifact.mimeType.startsWith("image/");
  const isAudio = artifact.mimeType.startsWith("audio/");
  const isVideo = artifact.mimeType.startsWith("video/");
  const isText = isTextArtifact(artifact);

  const { currentData: previewSas } = useArtifactPreviewUrlQuery(artifact.id, { skip: Boolean(artifact.previewUrl) || isText });
  const { currentData: downloadSas } = useArtifactDownloadUrlQuery(artifact.id, { skip: Boolean(artifact.downloadUrl) });
  const previewUrl = artifact.previewUrl || previewSas?.url;
  const downloadUrl = artifact.downloadUrl || downloadSas?.url;
  // Text is read through the API (which also streams Azure blobs).
  const { currentData: text, isLoading: textLoading, isError: textFailed } = useArtifactTextQuery(artifact.id, { skip: !isText });

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto bg-secondary/10">
        {isImage ? (
          <div className="flex h-full items-center justify-center bg-black/90 p-4">
            {previewUrl ? <img src={previewUrl} alt={artifact.kind} className="max-h-full max-w-full object-contain" /> : <Skeleton className="aspect-square h-3/4" />}
          </div>
        ) : isVideo ? (
          <div className="flex h-full items-center justify-center bg-black p-4">
            <video controls src={previewUrl || downloadUrl} className="max-h-full max-w-full rounded-lg" />
          </div>
        ) : isAudio ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 p-8">
            <span className="rounded-full bg-primary/15 p-5 text-primary">
              <Headphones className="h-10 w-10" />
            </span>
            <audio controls src={previewUrl || downloadUrl} className="w-full max-w-lg" />
          </div>
        ) : isText ? (
          <div className="mx-auto max-w-3xl p-6">
            {textLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : text !== undefined ? (
              <TextBody text={text} mimeType={artifact.mimeType} />
            ) : (
              <p className="text-sm text-muted-foreground">{textFailed ? "This file couldn't be read." : "Nothing to show."}</p>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-muted-foreground">
            <FileArchive className="h-10 w-10" />
            <span className="text-sm">No preview for {artifact.mimeType}; download it instead.</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/80 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {artifact.mimeType}
          {artifact.sizeBytes ? ` · ${formatBytes(artifact.sizeBytes)}` : ""}
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          {isText && text && (
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy text"}
            </Button>
          )}
          <Link to={`/workflows/${artifact.workflowId}`}>
            <Button variant="secondary" size="sm">
              <ExternalLink className="h-3.5 w-3.5" /> Open run
            </Button>
          </Link>
          {downloadUrl ? (
            <a href={downloadUrl} target="_blank" rel="noreferrer" download>
              <Button size="sm">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </a>
          ) : (
            <Button size="sm" disabled>
              <Download className="h-3.5 w-3.5" /> Loading…
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
