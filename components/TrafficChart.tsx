"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisResult, LogEntry } from "@/types/analysis";

/**
 * Pull the literal HH:MM straight out of the timestamp string so we show the
 * log's own wall-clock time. Using new Date()/toISOString() would convert the
 * -07:00 offset to UTC and display 15:00 instead of 08:00.
 */
function minuteLabel(timestamp: string): string {
  const m = timestamp.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : timestamp;
}

/** Bucket entries into per-minute counts (total + flagged) for the area chart. */
function buildTrafficSeries(entries: LogEntry[]) {
  const buckets = new Map<string, { total: number; flagged: number }>();
  for (const e of entries) {
    const key = minuteLabel(e.timestamp); // HH:MM in the log's own offset
    const b = buckets.get(key) ?? { total: 0, flagged: 0 };
    b.total += 1;
    if (e.flagged) b.flagged += 1;
    buckets.set(key, b);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([minute, v]) => ({ minute, ...v }));
}

function statusColor(code: string): string {
  const n = parseInt(code, 10);
  if (n >= 500) return "#f87171"; // red
  if (n >= 400) return "#fbbf24"; // amber
  if (n >= 300) return "#60a5fa"; // blue
  return "#34d399"; // emerald (2xx)
}

const tooltipStyle = {
  background: "hsl(222 44% 10%)",
  border: "1px solid hsl(217 33% 20%)",
  borderRadius: 8,
  fontSize: 12,
} as const;

export function TrafficChart({
  result,
  onStatusSelect,
}: {
  result: AnalysisResult;
  onStatusSelect?: (status: string) => void;
}) {
  const traffic = useMemo(
    () => buildTrafficSeries(result.entries),
    [result.entries]
  );
  const statusData = useMemo(
    () =>
      Object.entries(result.stats.statusBreakdown)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([status, count]) => ({ status, count })),
    [result.stats.statusBreakdown]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Requests per minute</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={traffic} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gFlagged" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 20%)" />
              <XAxis dataKey="minute" stroke="hsl(215 20% 65%)" fontSize={11} />
              <YAxis stroke="hsl(215 20% 65%)" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="#38bdf8"
                fill="url(#gTotal)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="flagged"
                name="Flagged"
                stroke="#f87171"
                fill="url(#gFlagged)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status codes</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 20%)" />
              <XAxis dataKey="status" stroke="hsl(215 20% 65%)" fontSize={11} />
              <YAxis stroke="hsl(215 20% 65%)" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(217 33% 18%)" }} />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                onClick={(d: { status?: string }) =>
                  d?.status && onStatusSelect?.(d.status)
                }
                className={onStatusSelect ? "cursor-pointer" : undefined}
              >
                {statusData.map((d) => (
                  <Cell key={d.status} fill={statusColor(d.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
