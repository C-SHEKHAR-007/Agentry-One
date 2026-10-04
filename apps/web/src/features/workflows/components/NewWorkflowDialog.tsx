import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";

export function NewWorkflowDialog({
  open,
  onOpenChange,
  projects,
  defaultProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Array<{ id: string; name: string }>;
  defaultProject: string;
}) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState(defaultProject);
  useEffect(() => {
    if (open) setPicked(defaultProject);
  }, [open, defaultProject]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New workflow</DialogTitle>
          <DialogDescription>Workflows belong to a project, which holds their runs and connected accounts.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (picked) navigate(`/templates/new?projectId=${picked}`);
          }}
          className="mt-4 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-workflow-project">Project</Label>
            <Select id="new-workflow-project" value={picked} onChange={(e) => setPicked(e.target.value)} required>
              <option value="">Choose a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Link to="/studio" className="text-xs text-muted-foreground hover:text-foreground">
              Or generate one in Content Studio →
            </Link>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!picked}>
                Continue
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
