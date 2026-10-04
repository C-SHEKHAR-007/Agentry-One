import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Images, Search, X } from "lucide-react";
import { useArtifactKindsQuery, useArtifactsPageInfiniteQuery } from "../artifacts.api";
import { useProjectsQuery } from "../../projects/projects.api";
import { useDebounced } from "../../../hooks/useDebounced";
import { LoadMore } from "../../../components/common/LoadMore";
import { PageHeader } from "../../../components/common/PageHeader";
import { EmptyState } from "../../../components/ui/empty-state";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import { ArtifactCard } from "../components/ArtifactCard";
import { ArtifactViewer } from "../components/ArtifactViewer";

/** Matches the page size in artifacts.api (each page's cards animate in from the start). */
const ARTIFACT_PAGE_SIZE = 48;

export function ArtifactsPage() {
  const [projectId, setProjectId] = useState("");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [viewing, setViewing] = useState<number | null>(null);

  const { data: projects } = useProjectsQuery();
  // Every kind there is, not just the kinds among the loaded cards.
  const { data: kinds = [] } = useArtifactKindsQuery(projectId || undefined);
  // A page at a time; currentData so a new filter never shows the previous
  // filter's artifacts.
  const pages = useArtifactsPageInfiniteQuery({ projectId: projectId || undefined, kind: kind || undefined, q: q || undefined });
  const artifacts = useMemo(() => pages.currentData?.pages.flatMap((p) => p.items) ?? null, [pages.currentData]);
  const filtered = Boolean(projectId || kind || q);

  return (
    <div>
      <PageHeader
        title="Artifacts"
        description="Everything your agents have produced — stored, checksummed, and accessible via expiring SAS links."
        actions={
          <>
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search artifacts"
                title="Search by project, agent or kind"
                aria-label="Search artifacts"
                className="pl-8 pr-8"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-40" aria-label="Filter by project">
              <option value="">All projects</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-36" aria-label="Filter by kind">
              <option value="">All kinds</option>
              {[...new Set([...kinds, ...(kind ? [kind] : [])])].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </>
        }
      />

      {!artifacts && (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 break-inside-avoid rounded-xl" />
          ))}
        </div>
      )}

      {artifacts?.length === 0 &&
        (filtered ? (
          <EmptyState icon={Search} title="Nothing matches" description="Try another search, project or kind." />
        ) : (
          <EmptyState icon={Images} title="No artifacts yet" description="Run an agent and its outputs will collect here." />
        ))}

      <AnimatePresence>
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
          {artifacts?.map((a, i) => (
            <ArtifactCard key={a.id} artifact={a} index={i % ARTIFACT_PAGE_SIZE} onPreview={() => setViewing(i)} />
          ))}
        </div>
      </AnimatePresence>

      <LoadMore
        shown={artifacts?.length ?? 0}
        hasMore={pages.hasNextPage}
        loading={pages.isFetchingNextPage}
        onLoad={() => pages.fetchNextPage()}
        noun="artifacts"
      />

      <ArtifactViewer
        artifacts={artifacts ?? []}
        index={viewing}
        onIndex={setViewing}
        onClose={() => setViewing(null)}
        hasMore={pages.hasNextPage}
        loadingMore={pages.isFetchingNextPage}
        onLoadMore={() => pages.fetchNextPage()}
      />
    </div>
  );
}
