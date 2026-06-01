import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { classifyAttack } from "@/lib/attackClassification";
import type { Anomaly } from "@/types/analysis";

export function TopAttackingIPs({
  anomalies,
  onSelectIp,
}: {
  anomalies: Anomaly[];
  onSelectIp?: (ip: string) => void;
}) {
  if (anomalies.length === 0) return null;

  const ranked = [...anomalies].sort((a, b) => b.confidence - a.confidence);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Attacking IPs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ranked.map((a, i) => {
          const attack = classifyAttack(a.reason);
          const pct = Math.round(a.confidence * 100);
          return (
            <button
              key={`${a.ip}-${i}`}
              type="button"
              onClick={() => onSelectIp?.(a.ip)}
              title="View this IP's anomaly"
              className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <span className="w-36 shrink-0 truncate font-mono text-sm font-bold">
                {a.ip}
              </span>
              <Badge variant={attack.variant}>{attack.label}</Badge>
              <div className="flex flex-1 items-center gap-2">
                <Progress value={pct} className="h-1.5" />
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {pct}%
                </span>
              </div>
              <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                {a.relatedEntries.length}{" "}
                {a.relatedEntries.length === 1 ? "event" : "events"}
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
