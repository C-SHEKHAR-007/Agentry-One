import { useMemo, useState } from "react";
import { Images } from "lucide-react";
import { useArtifactsPageInfiniteQuery } from "../../artifacts/artifacts.api";
import { ArtifactCard } from "../../../components/common/ArtifactCard";
import { ArtifactViewer } from "../../../components/common/ArtifactViewer";
import { LoadMore } from "../../../components/common/LoadMore";
import { EmptyState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/skeleton";

/** Every artifact of one project, a page at a time, with the full-screen viewer. */
export function ProjectArtifacts({ projectId }: { projectId: string }) {
  const pages = useArtifactsPageInfiniteQuery({ projectId });
  const artifacts = useMemo(() => pages.currentData?.pages.flatMap((p) => p.items) ?? null, [pages.currentData]);
  const [viewing, setViewing] = useState<number | null>(null);

  if (!artifacts) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }
  if (artifacts.length === 0) return <EmptyState icon={Images} title="No artifacts yet" description="Run an agent in this project and its outputs collect here." />;

  return (
    <>
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
        {artifacts.map((a, i) => (
          <ArtifactCard key={a.id} artifact={a} index={i % 48} onPreview={() => setViewing(i)} />
        ))}
      </div>
      <LoadMore shown={artifacts.length} hasMore={pages.hasNextPage} loading={pages.isFetchingNextPage} onLoad={() => pages.fetchNextPage()} noun="artifacts" />
      <ArtifactViewer
        artifacts={artifacts}
        index={viewing}
        onIndex={setViewing}
        onClose={() => setViewing(null)}
        hasMore={pages.hasNextPage}
        loadingMore={pages.isFetchingNextPage}
        onLoadMore={() => pages.fetchNextPage()}
      />
    </>
  );
}
