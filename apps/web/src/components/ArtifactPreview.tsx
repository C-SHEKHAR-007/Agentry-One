import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  Eye,
  FileArchive,
  FileText,
  Headphones,
  Maximize2,
} from "lucide-react";
import { downloadUrl } from "../api/client.js";
import { formatBytes } from "../lib/format";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Skeleton } from "./ui/skeleton";

export interface ArtifactItem {
  id: string;
  workflowId?: string;
  kind: string;
  mimeType: string;
  sizeBytes?: number | null;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  createdAt?: string;
  metadata?: Record<string, any> | null;
}

interface ArtifactPreviewProps {
  artifact: ArtifactItem;
  className?: string;
  compact?: boolean;
}

export function ArtifactPreview({ artifact, className = "", compact = false }: ArtifactPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isImage = artifact.mimeType.startsWith("image/");
  const isAudio = artifact.mimeType.startsWith("audio/");
  const isVideo = artifact.mimeType.startsWith("video/");
  const isText =
    artifact.mimeType.startsWith("text/") ||
    artifact.mimeType.includes("json") ||
    artifact.kind === "text" ||
    artifact.kind === "search_brief";

  const fileUrl = artifact.previewUrl || artifact.downloadUrl || downloadUrl(artifact.id);

  // Lazy-load text content if it's a text-based artifact
  const { data: textContent, isLoading: textLoading } = useQuery({
    queryKey: ["artifact-content", artifact.id],
    queryFn: async () => {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Failed to load artifact content");
      return res.text();
    },
    enabled: isText,
    staleTime: 5 * 60 * 1000,
  });

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <>
      <div
        className={`group overflow-hidden rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-200 hover:border-primary/50 hover:shadow-md ${className}`}
      >
        {/* Content Area */}
        <div className="relative">
          {isImage ? (
            <div className="relative overflow-hidden bg-black/5 dark:bg-black/20">
              <img
                src={fileUrl}
                alt={artifact.kind}
                loading="lazy"
                className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="absolute right-2 top-2 rounded-md bg-black/50 p-1.5 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                title="Full View"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          ) : isAudio ? (
            <div className="p-4 space-y-3 bg-secondary/20">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Headphones className="h-4 w-4" />
                <span>Audio Recording / Voiceover</span>
              </div>
              <audio controls src={fileUrl} className="w-full h-9 rounded" preload="metadata" />
            </div>
          ) : isVideo ? (
            <div className="p-2 bg-black/40">
              <video controls src={fileUrl} className="w-full rounded-lg max-h-72" preload="metadata" />
            </div>
          ) : isText ? (
            <div className="relative p-4 bg-secondary/10">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  {artifact.kind}
                </span>
                {textContent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleCopy(textContent)}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-success mr-1" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                )}
              </div>

              {textLoading ? (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : textContent ? (
                <div
                  className={`relative font-mono text-xs text-foreground/90 whitespace-pre-wrap break-words leading-relaxed overflow-y-auto ${
                    compact ? "max-h-36" : "max-h-72"
                  } rounded-md bg-background/60 p-3 border border-border/50`}
                >
                  {textContent}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">Content preview unavailable</p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-5 bg-secondary/15">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileArchive className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{artifact.kind}</p>
                <p className="text-xs text-muted-foreground">{artifact.mimeType}</p>
              </div>
            </div>
          )}
        </div>

        {/* Action / Meta Footer */}
        <div className="flex items-center justify-between border-t border-border/60 bg-card/40 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 truncate">
            <Badge variant="outline" className="text-[10px] capitalize shrink-0 font-normal">
              {artifact.kind}
            </Badge>
            {artifact.sizeBytes ? (
              <span className="text-muted-foreground">{formatBytes(artifact.sizeBytes)}</span>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isText && textContent && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                title="View Expanded"
                onClick={() => setDialogOpen(true)}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}
            <a href={fileUrl} download={`${artifact.kind}-${artifact.id.slice(0, 6)}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                <Download className="h-3.5 w-3.5 mr-1" />
                Download
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Expanded Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-6">
          <DialogTitle className="flex items-center justify-between pb-3 border-b border-border">
            <span className="capitalize">{artifact.kind} Preview</span>
            <Badge variant="outline">{artifact.mimeType}</Badge>
          </DialogTitle>

          <div className="mt-4">
            {isImage ? (
              <img src={fileUrl} alt={artifact.kind} className="w-full max-h-[70vh] object-contain rounded-lg" />
            ) : isText && textContent ? (
              <div className="relative">
                <div className="absolute right-2 top-2">
                  <Button size="sm" variant="secondary" onClick={() => handleCopy(textContent)}>
                    {copied ? <Check className="h-3.5 w-3.5 mr-1 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? "Copied" : "Copy All"}
                  </Button>
                </div>
                <pre className="p-4 rounded-lg bg-secondary/20 border border-border font-mono text-xs whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto leading-relaxed">
                  {textContent}
                </pre>
              </div>
            ) : isAudio ? (
              <audio controls src={fileUrl} className="w-full" autoPlay />
            ) : isVideo ? (
              <video controls src={fileUrl} className="w-full rounded-lg" autoPlay />
            ) : (
              <p className="text-sm text-muted-foreground">Binary file preview not supported.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
