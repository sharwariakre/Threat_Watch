import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TimelineEvent } from "@/types/analysis";

const DOT: Record<TimelineEvent["severity"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-500",
};

export function TimelinePanel({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => a.time.localeCompare(b.time));

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
            {sorted.map((ev, i) => (
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
                <p className="mt-1 text-sm">{ev.event}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
