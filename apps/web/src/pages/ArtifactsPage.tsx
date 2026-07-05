import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Download, ExternalLink, FileArchive, Images } from "lucide-react";
import { useArtifacts, useProjects } from "../api/queries";
import { downloadUrl } from "../api/client";
import type { ArtifactListItem } from "../api/types";
import { formatBytes, timeAgo } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";

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
        description="Everything your agents have produced — stored, checksummed, and downloadable."
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
            <Skeleton key={i} className="h-48 break-inside-avoid" />
          ))}
        </div>
      )}

      {artifacts?.length === 0 && (
        <EmptyState
          icon={Images}
          title="No artifacts yet"
          description="Run an agent and its outputs will collect here."
        />
      )}

      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
        {artifacts?.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.5) }}
            className="break-inside-avoid"
          >
            <button
              onClick={() => setPreview(a)}
              className="group block w-full overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/50"
            >
              {a.mimeType.startsWith("image/") ? (
                <img
                  src={downloadUrl(a.id)}
                  alt={a.kind}
                  loading="lazy"
                  className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex items-center gap-2 p-6">
                  <FileArchive className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm">{a.kind}</span>
                </div>
              )}
              <div className="px-3 py-2">
                <p className="truncate text-xs text-muted-foreground">
                  {a.projectName} · {timeAgo(a.createdAt)}
                </p>
              </div>
            </button>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          {preview && (
            <div>
              <DialogTitle className="sr-only">Artifact preview</DialogTitle>
              {preview.mimeType.startsWith("image/") ? (
                <img src={downloadUrl(preview.id)} alt={preview.kind} className="w-full" />
              ) : (
                <div className="flex items-center gap-3 p-10">
                  <FileArchive className="h-8 w-8 text-muted-foreground" />
                  <span>{preview.kind}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
                <div className="text-sm">
                  <p className="font-medium">{preview.kind}</p>
                  <p className="text-xs text-muted-foreground">
                    {preview.mimeType} · {formatBytes(preview.sizeBytes)} ·{" "}
                    {timeAgo(preview.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/workflows/${preview.workflowId}`}>
                    <Button variant="secondary" size="sm">
                      <ExternalLink className="h-3.5 w-3.5" /> Open workflow
                    </Button>
                  </Link>
                  <a href={downloadUrl(preview.id)} download>
                    <Button size="sm">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
