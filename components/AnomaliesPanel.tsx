"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Anomaly } from "@/types/analysis";

function confidenceColor(c: number): string {
  if (c >= 0.8) return "bg-red-500";
  if (c >= 0.5) return "bg-amber-500";
  return "bg-slate-500";
}

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(anomaly.confidence * 100);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm font-semibold">{anomaly.ip}</div>
          <p className="mt-1 text-sm text-muted-foreground">{anomaly.reason}</p>
        </div>
        <Badge variant={pct >= 80 ? "high" : pct >= 50 ? "medium" : "low"}>
          {pct}%
        </Badge>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Confidence</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <Progress value={pct} indicatorClassName={confidenceColor(anomaly.confidence)} />
      </div>

      {anomaly.relatedEntries.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {anomaly.relatedEntries.length} related log{" "}
            {anomaly.relatedEntries.length === 1 ? "entry" : "entries"}
          </button>
          {open && (
            <div className="mt-2 max-h-56 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-xs">
              {anomaly.relatedEntries.map((e, i) => (
                <div key={i} className="whitespace-nowrap py-0.5">
                  <span className="text-muted-foreground">{e.timestamp}</span>{" "}
                  {e.method} {e.url}{" "}
                  <span className={e.status >= 400 ? "text-red-400" : "text-emerald-400"}>
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AnomaliesPanel({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Detected Anomalies ({anomalies.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {anomalies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No anomalies detected.</p>
        ) : (
          anomalies
            .slice()
            .sort((a, b) => b.confidence - a.confidence)
            .map((a, i) => <AnomalyCard key={`${a.ip}-${i}`} anomaly={a} />)
        )}
      </CardContent>
    </Card>
  );
}
