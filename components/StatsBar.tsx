import { Activity, Globe, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@/types/analysis";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Pull the literal date/time parts out of an ISO string (ignores the offset). */
function parseParts(ts: string) {
  const m = ts.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, , month, day, hh, mm] = m;
  return {
    date: `${MONTHS[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`,
    time: `${hh}:${mm}`,
    ymd: `${m[1]}-${month}-${day}`,
  };
}

/**
 * Turn the stored "<ISO> – <ISO>" range into something human-readable like
 * "Mar 12, 08:00 – 08:02". Times are shown as the log's own wall-clock time
 * (the embedded offset is preserved, not converted to UTC).
 */
function formatTimeRange(range: string): string {
  const parts = range.split(/\s+[–-]\s+/);
  if (parts.length !== 2) return range;

  const start = parseParts(parts[0]);
  const end = parseParts(parts[1]);
  if (!start || !end) return range;

  const endLabel =
    start.ymd === end.ymd ? end.time : `${end.date}, ${end.time}`;
  return `${start.date}, ${start.time} – ${endLabel}`;
}

function StatTile({
  icon,
  label,
  value,
  valueClassName = "text-2xl",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  valueClassName?: string;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick);
  return (
    <Card
      onClick={onClick}
      title={clickable ? "Click to view" : undefined}
      className={cn(
        "transition",
        clickable &&
          "cursor-pointer hover:brightness-125 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      {...(clickable
        ? {
            role: "button",
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            },
          }
        : {})}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-muted p-2 text-foreground">{icon}</div>
        <div className="min-w-0">
          <div className={`truncate font-semibold tabular-nums ${valueClassName}`}>
            {value}
          </div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsBar({
  result,
  onAnomaliesClick,
  onTotalClick,
  onUniqueIPsClick,
}: {
  result: AnalysisResult;
  onAnomaliesClick?: () => void;
  onTotalClick?: () => void;
  onUniqueIPsClick?: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        icon={<Activity className="h-5 w-5" />}
        label="Total Requests"
        value={result.stats.total.toLocaleString()}
        onClick={onTotalClick}
      />
      <StatTile
        icon={<Globe className="h-5 w-5" />}
        label="Unique IPs"
        value={result.stats.uniqueIPs.toLocaleString()}
        onClick={onUniqueIPsClick}
      />
      <StatTile
        icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
        label="Anomalies Found"
        value={result.anomalies.length}
        onClick={onAnomaliesClick}
      />
      <StatTile
        icon={<Clock className="h-5 w-5" />}
        label="Time Range"
        value={formatTimeRange(result.stats.timeRange)}
        valueClassName="text-base"
      />
    </div>
  );
}
