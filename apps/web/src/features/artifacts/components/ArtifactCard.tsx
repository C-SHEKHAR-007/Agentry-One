import { motion } from "framer-motion";
import { FileArchive, FileText, Headphones, Eye, Video as VideoIcon } from "lucide-react";
import { useArtifactPreviewUrlQuery } from "../artifacts.api";
import { stripMarkdown } from "../../../components/common/Markdown";
import type { ArtifactListItem } from "../../../models";
import { timeAgo } from "../../../lib/format";
import { Skeleton } from "../../../components/ui/skeleton";
import { Badge } from "../../../components/ui/badge";

/** Text-like outputs (captions, briefs, JSON) -- same rule as the API's text previews. */
export const isTextArtifact = (a: { mimeType: string; kind: string }) =>
  a.mimeType.startsWith("text/") || a.mimeType.includes("json") || a.kind === "text" || a.kind === "search_brief";

// ── Per-card component so each hook call is at the top level ──────────────────
export function ArtifactCard({
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
  const isText = isTextArtifact(artifact);

  const needsSas = !artifact.previewUrl && isImage;
  const { currentData: sas } = useArtifactPreviewUrlQuery(artifact.id, { skip: !needsSas });
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
            <span className="text-[11px] text-muted-foreground">{artifact.mimeType}</span>
          </div>
        ) : isText ? (
          <div className="p-5 bg-secondary/10 flex flex-col justify-between min-h-[120px]">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {artifact.kind}
              </span>
            </div>
            {artifact.textPreview ? (
              <p className={`mt-2 line-clamp-6 whitespace-pre-line break-words text-xs leading-relaxed text-foreground/85 ${artifact.mimeType.includes("json") ? "font-mono" : ""}`}>
                {artifact.mimeType.includes("json") ? artifact.textPreview : stripMarkdown(artifact.textPreview)}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Open to read the full text.</p>
            )}
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
          <Badge variant="outline" className="ml-2 shrink-0 text-[11px] capitalize">
            {artifact.kind}
          </Badge>
        </div>
      </button>
    </motion.div>
  );
}
