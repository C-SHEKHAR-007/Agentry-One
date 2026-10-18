import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Trash2 } from "lucide-react";
import { useAddScheduleMutation, useDeleteScheduleMutation, useSchedulesQuery } from "../../templates.api";
import { describeCron, localTimezone } from "../../../../lib/cron";
import { errorMessage } from "../../../../services/http/errors";
import { CronBuilder } from "../../../../components/common/CronBuilder";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent } from "../../../../components/ui/card";
import { Spinner } from "../../../../components/ui/spinner";

/** Run the workflow on a schedule, with the run inputs filled in on the left. */
export function ScheduleCard({ templateId, runInputs }: { templateId: string; runInputs: Record<string, unknown> }) {
  const timezone = localTimezone();
  const [cronExpr, setCronExpr] = useState("0 9 * * 2"); // Tuesdays at 09:00
  const { data: schedules } = useSchedulesQuery(templateId);

  const [addSchedule, addState] = useAddScheduleMutation();
  const save = () =>
    addSchedule({ templateId, cronExpr, timezone, runInputs })
      .unwrap()
      .then(() => toast.success(`Scheduled: ${describeCron(cronExpr)}`))
      .catch((err) => toast.error(errorMessage(err)));

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [removeSchedule, removeState] = useDeleteScheduleMutation();
  const remove = (id: string) =>
    removeSchedule({ scheduleId: id, templateId })
      .unwrap()
      .then(() => {
        toast.success("Schedule removed");
        setConfirmDeleteId(null);
      })
      .catch((err) => toast.error(errorMessage(err)));

  return (
    <Card glass>
      <CardContent className="space-y-4 pt-5">
        <div>
          <h3 className="text-sm font-semibold">Schedule</h3>
          <p className="text-xs text-muted-foreground">Run it on repeat with the inputs on the left.</p>
        </div>

        <CronBuilder value={cronExpr} onChange={setCronExpr} timezone={timezone} />

        <Button variant="secondary" onClick={save} disabled={addState.isLoading || !cronExpr.trim()}>
          {addState.isLoading ? <Spinner className="mr-2" /> : <CalendarPlus className="h-4 w-4" />}
          Set schedule
        </Button>

        {schedules && schedules.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Active schedules</p>
            {schedules.map((sch) => (
              <div key={sch.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{describeCron(sch.cronExpr)}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {sch.cronExpr} · {sch.timezone ?? "server time"}
                  </p>
                </div>
                {confirmDeleteId === sch.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="destructive" disabled={removeState.isLoading} onClick={() => remove(sch.id)}>
                      Remove
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" aria-label="Remove schedule" onClick={() => setConfirmDeleteId(sch.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
