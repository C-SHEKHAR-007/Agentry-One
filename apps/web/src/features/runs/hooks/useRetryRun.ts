import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { errorMessage } from "../../../services/http/errors";
import { useRetryWorkflowRunMutation } from "../runs.api";

/** Retries a workflow run and opens the new run. */
export function useRetryRun(runId: string) {
  const navigate = useNavigate();
  const [retry, state] = useRetryWorkflowRunMutation();
  return {
    isPending: state.isLoading,
    /** The step the pending retry starts from (undefined: the failed step). */
    pendingFrom: state.isLoading ? state.originalArgs?.fromStepOrder : undefined,
    retry: (fromStepOrder?: number) =>
      retry({ runId, fromStepOrder })
        .unwrap()
        .then((r) => {
          toast.success("Retry started: completed steps are reused");
          navigate(`/template-runs/${r.id}`);
        })
        .catch((err) => toast.error(errorMessage(err))),
  };
}
