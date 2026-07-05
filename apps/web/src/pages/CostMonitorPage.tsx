import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CircleDollarSign, HelpCircle, PiggyBank, Zap } from "lucide-react";
import { api } from "../api/client";
import type { CostBreakdown } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { PricingEditor } from "../components/PricingEditor";
import { StatCard } from "../components/StatCard";
import { CHART, ChartLegend, ChartTooltip } from "../components/charts/chartTheme";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Donut } from "../components/ui/donut";
import { Select } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";

export function CostMonitorPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["stats", "costs", days],
    queryFn: () => api.get<CostBreakdown>(`/stats/costs?days=${days}`),
  });

  const totalJobs = (data?.perProvider ?? []).reduce((a, p) => a + p.jobs, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cost Monitor"
        description="Real spend per provider from per-job attribution; savings compare zero-cost local runs against the reference premium price."
        actions={
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="w-36">
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data ? (
          <>
            <StatCard
              icon={CircleDollarSign}
              label="Spend"
              value={`$${data.totalUsd.toFixed(2)}`}
              sub={`last ${days} days`}
              color="hsl(var(--chart-1))"
            />
            <StatCard
              icon={PiggyBank}
              label="Saved (est.)"
              value={`$${data.savedUsd.toFixed(2)}`}
              sub={`vs. $${data.referenceUsd}/job premium`}
              color="hsl(var(--chart-2))"
              delay={0.05}
            />
            <StatCard
              icon={Zap}
              label="Attributed Jobs"
              value={totalJobs}
              sub="completed with known provider"
              color="hsl(var(--chart-3))"
              delay={0.1}
            />
            <StatCard
              icon={HelpCircle}
              label="Unattributed"
              value={data.unattributedJobs}
              sub="jobs before attribution landed"
              color="hsl(var(--chart-4))"
              delay={0.15}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[110px]" />)
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card glass className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Spend & savings per day</CardTitle>
            <ChartLegend
              items={[
                { label: "Spent (USD)", color: CHART.categorical[0] },
                { label: "Saved est. (USD)", color: CHART.categorical[1] },
              ]}
            />
          </CardHeader>
          <CardContent>
            {isLoading && <Skeleton className="h-64" />}
            {data && data.perDay.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No completed jobs in this window yet.
              </p>
            )}
            {data && data.perDay.length > 0 && (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.perDay} barCategoryGap="30%">
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
                    width={44}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--secondary) / 0.5)" }}
                    content={
                      <ChartTooltip formatter={(v, n) => (n.includes("USD") ? `$${v.toFixed(2)}` : String(v))} />
                    }
                  />
                  <Bar
                    dataKey="usd"
                    name="Spent (USD)"
                    stackId="money"
                    fill={CHART.categorical[0]}
                  />
                  <Bar
                    dataKey="savedUsd"
                    name="Saved est. (USD)"
                    stackId="money"
                    fill={CHART.categorical[1]}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card glass>
          <CardHeader>
            <CardTitle className="text-base">Jobs by provider</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5">
            {data && data.perProvider.length === 0 && (
              <p className="py-8 text-sm text-muted-foreground">No attributed jobs yet.</p>
            )}
            {data && data.perProvider.length > 0 && (
              <>
                <Donut
                  size={150}
                  thickness={16}
                  segments={data.perProvider.map((p, i) => ({
                    value: p.jobs,
                    color: CHART.categorical[i % CHART.categorical.length],
                  }))}
                >
                  <p className="text-xl font-semibold">{totalJobs}</p>
                  <p className="text-xs text-muted-foreground">jobs</p>
                </Donut>
                <div className="w-full space-y-1.5">
                  {data.perProvider.map((p, i) => (
                    <div key={p.providerType} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: CHART.categorical[i % CHART.categorical.length] }}
                      />
                      <span className="min-w-0 flex-1 truncate">{p.providerType}</span>
                      <span className="text-muted-foreground">{p.jobs}</span>
                      <span className="w-16 text-right text-muted-foreground">
                        ${p.usd.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <PricingEditor />
        </CardContent>
      </Card>
    </div>
  );
}
