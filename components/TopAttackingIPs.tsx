import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { classifyAttack } from "@/lib/attackClassification";
import type { Anomaly } from "@/types/analysis";

export function TopAttackingIPs({ anomalies }: { anomalies: Anomaly[] }) {
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
            <div
              key={`${a.ip}-${i}`}
              className="flex items-center gap-3 rounded-md border border-border p-3"
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
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
