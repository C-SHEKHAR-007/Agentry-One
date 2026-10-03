import { ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";

/** Footer for a paged list: how many are shown, and a button for the next page. */
export function LoadMore({
  shown,
  hasMore,
  loading,
  onLoad,
  noun,
}: {
  shown: number;
  hasMore: boolean;
  loading: boolean;
  onLoad: () => void;
  /** Plural, e.g. "runs". */
  noun: string;
}) {
  if (shown === 0) return null;
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground">
        {hasMore ? `Showing the latest ${shown} ${noun}` : `All ${shown} ${noun}`}
      </p>
      {hasMore && (
        <Button variant="secondary" size="sm" onClick={onLoad} disabled={loading}>
          {loading ? <Spinner className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} Load more
        </Button>
      )}
    </div>
  );
}
