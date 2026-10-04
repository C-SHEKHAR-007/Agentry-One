import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import { buttonVariants } from "../ui/button";

export function NotFoundPage({ what = "page" }: { what?: string }) {
  return (
    <EmptyState
      icon={Compass}
      title={`This ${what} doesn't exist`}
      description="It may have been deleted, or you may not have access to it."
      action={
        <Link to="/" className={buttonVariants({ variant: "secondary" })}>
          Back to dashboard
        </Link>
      }
    />
  );
}
