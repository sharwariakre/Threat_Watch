import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/types/analysis";

const DOT: Record<TimelineEvent["severity"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-500",
};

export function TimelinePanel({
  events,
  anomalyIps = [],
  onSelectIp,
}: {
  events: TimelineEvent[];
  anomalyIps?: string[];
  onSelectIp?: (ip: string) => void;
}) {
  const sorted = [...events].sort((a, b) => a.time.localeCompare(b.time));

  // An event is clickable if its text mentions an IP that exists in the anomalies.
  const matchIp = (text: string) =>
    anomalyIps.find((ip) => text.includes(ip)) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Event Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timeline events.</p>
        ) : (
          <ol className="relative space-y-5 border-l border-border pl-6">
            {sorted.map((ev, i) => {
              const ip = matchIp(ev.event);
              const clickable = Boolean(ip && onSelectIp);
              return (
                <li key={i} className="relative">
                  <span
                    className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-background ${DOT[ev.severity]}`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <time className="font-mono text-xs text-muted-foreground">
                      {ev.time}
                    </time>
                    <Badge variant={ev.severity}>{ev.severity}</Badge>
                  </div>
                  <p
                    onClick={clickable ? () => onSelectIp?.(ip!) : undefined}
                    title={clickable ? "Jump to this IP's anomaly" : undefined}
                    className={cn(
                      "mt-1 text-sm",
                      clickable &&
                        "cursor-pointer rounded hover:text-primary hover:underline"
                    )}
                  >
                    {ev.event}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
