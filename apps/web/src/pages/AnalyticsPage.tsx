import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Bot, CheckCircle2, Clock } from "lucide-react";
import { api } from "../api/client";
import { useAgentStats, useStatsOverview } from "../api/queries";
import { formatDuration, formatPercent, timeAgo } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { CHART, ChartLegend, ChartTooltip } from "../components/charts/chartTheme";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Donut } from "../components/ui/donut";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";

interface SeriesResponse {
  days: number;
  perDay: { date: string; completed: number; failed: number; avgDurationMs: number | null }[];
}

export function AnalyticsPage() {
  const [days, setDays] = useState(14);
  const { data: series, isLoading } = useQuery({
    queryKey: ["stats", "series", days],
    queryFn: () => api.get<SeriesResponse>(`/stats/series?days=${days}`),
  });
  const { data: overview } = useStatsOverview();
  const { data: agentStats } = useAgentStats();

  const agents = agentStats?.agents ?? [];
  const totalRuns = agents.reduce((a, s) => a + s.runs, 0);
  const durationSeries = (series?.perDay ?? []).filter((d) => d.avgDurationMs != null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="How your agents are performing — volume, reliability, and speed over time."
        actions={
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="w-36">
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview ? (
          <>
            <StatCard
              icon={Activity}
              label="Jobs Completed Today"
              value={overview.jobs.completedToday}
              sub={`${overview.jobs.failedToday} failed today`}
              color="hsl(var(--chart-1))"
            />
            <StatCard
              icon={CheckCircle2}
              label="Success Rate (30d)"
              value={formatPercent(overview.successRate)}
              color="hsl(var(--chart-2))"
              delay={0.05}
            />
            <StatCard
              icon={Clock}
              label="Avg. Duration (30d)"
              value={formatDuration(overview.avgDurationMs)}
              color="hsl(var(--chart-3))"
              delay={0.1}
            />
            <StatCard
              icon={Bot}
              label="Registered Agents"
              value={overview.agents.total}
              color="hsl(var(--chart-4))"
              delay={0.15}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[110px]" />)
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card glass>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Job outcomes per day</CardTitle>
            {/* completed/failed are statuses -- reserved status colors + legend */}
            <ChartLegend
              items={[
                { label: "Completed", color: CHART.status.good },
                { label: "Failed", color: CHART.status.bad },
              ]}
            />
          </CardHeader>
          <CardContent>
            {isLoading && <Skeleton className="h-64" />}
            {series && (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={series.perDay} barCategoryGap="30%">
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={CHART.tick}
                    axisLine={CHART.axisLine}
                    tickLine={false}
                    tickFormatter={(d: string) => d.slice(5)}
                  />
                  <YAxis tick={CHART.tick} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--secondary) / 0.5)" }}
                    content={<ChartTooltip />}
                  />
                  <Bar dataKey="completed" name="Completed" stackId="jobs" fill={CHART.status.good} />
                  <Bar
                    dataKey="failed"
                    name="Failed"
                    stackId="jobs"
                    fill={CHART.status.bad}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card glass>
          <CardHeader>
            {/* single series -- the title names it, no legend needed */}
            <CardTitle className="text-base">Avg. generation time (seconds)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <Skeleton className="h-64" />}
            {series && durationSeries.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No completed runs in this window yet.
              </p>
            )}
            {series && durationSeries.length > 0 && (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={durationSeries}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={CHART.tick}
                    axisLine={CHART.axisLine}
                    tickLine={false}
                    tickFormatter={(d: string) => d.slice(5)}
                  />
                  <YAxis
                    tick={CHART.tick}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}s`}
                  />
                  <Tooltip
                    content={<ChartTooltip formatter={(v) => `${(v / 1000).toFixed(1)}s`} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgDurationMs"
                    name="Avg duration"
                    stroke={CHART.categorical[0]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: CHART.categorical[0] }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Agent breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-8 sm:flex-row sm:items-start min-w-0">
          <Donut
            segments={agents.map((a, i) => ({
              value: a.runs,
              color: CHART.categorical[i % CHART.categorical.length],
            }))}
          >
            <p className="text-2xl font-semibold">{totalRuns}</p>
            <p className="text-xs text-muted-foreground">runs</p>
          </Donut>
          <div className="w-full flex-1 min-w-0 overflow-x-auto">
            {agents.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
            {agents.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Agent</th>
                    <th className="pb-2 pr-4 font-medium">Runs</th>
                    <th className="pb-2 pr-4 font-medium">Share</th>
                    <th className="pb-2 pr-4 font-medium">Success</th>
                    <th className="pb-2 pr-4 font-medium">Avg time</th>
                    <th className="pb-2 font-medium">Last run</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a, i) => (
                    <tr key={a.agentId} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-4">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: CHART.categorical[i % CHART.categorical.length] }}
                          />
                          {a.name}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{a.runs}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{Math.round(a.share * 100)}%</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatPercent(a.successRate)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDuration(a.avgDurationMs)}</td>
                      <td className="py-2 text-muted-foreground">{timeAgo(a.lastRunAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
