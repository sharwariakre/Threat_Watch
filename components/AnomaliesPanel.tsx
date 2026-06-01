"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { classifyAttack } from "@/lib/attackClassification";
import { cn } from "@/lib/utils";
import type { Anomaly } from "@/types/analysis";

/** Signal from the page telling the panel to scroll to / expand / flash a card. */
export interface AnomalyFocus {
  ip: string;
  expand: boolean;
  flash: boolean;
  nonce: number;
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return "bg-red-500";
  if (c >= 0.5) return "bg-amber-500";
  return "bg-slate-500";
}

function AnomalyCard({
  anomaly,
  open,
  onToggle,
  onFilterIp,
  flash,
  onFlashEnd,
  cardRef,
}: {
  anomaly: Anomaly;
  open: boolean;
  onToggle: () => void;
  onFilterIp?: (ip: string) => void;
  flash: boolean;
  onFlashEnd: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const pct = Math.round(anomaly.confidence * 100);
  const attack = classifyAttack(anomaly.reason);

  return (
    <div
      ref={cardRef}
      onAnimationEnd={(e) => {
        // Only react to this card's own flash animation, not bubbled children.
        if (e.target === e.currentTarget) onFlashEnd();
      }}
      className={cn("rounded-lg border border-border p-4", flash && "flash-highlight")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="group flex items-center gap-2">
            <button
              type="button"
              onClick={() => onFilterIp?.(anomaly.ip)}
              title="Filter logs by this IP"
              className="font-mono text-sm font-semibold hover:text-primary hover:underline"
            >
              {anomaly.ip}
            </button>
            <Badge variant={attack.variant}>{attack.label}</Badge>
            <span className="hidden items-center gap-0.5 text-xs text-muted-foreground group-hover:inline-flex">
              <Filter className="h-3 w-3" />
              Filter logs ↓
            </span>
          </div>
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
            onClick={onToggle}
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

export function AnomaliesPanel({
  anomalies,
  onFilterIp,
  focus,
}: {
  anomalies: Anomaly[];
  onFilterIp?: (ip: string) => void;
  focus?: AnomalyFocus | null;
}) {
  const sorted = useMemo(
    () => [...anomalies].sort((a, b) => b.confidence - a.confidence),
    [anomalies]
  );
  const [openIps, setOpenIps] = useState<Set<string>>(new Set());
  const [flashIp, setFlashIp] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // React to a focus signal: scroll the card into view, optionally expand + flash.
  useEffect(() => {
    if (!focus) return;
    const el = cardRefs.current.get(focus.ip);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (focus.expand) {
      setOpenIps((prev) => new Set(prev).add(focus.ip));
    }
    if (focus.flash) {
      setFlashIp(null);
      // next tick so the animation restarts even if the same card was flashing
      requestAnimationFrame(() => setFlashIp(focus.ip));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  const toggle = (ip: string) =>
    setOpenIps((prev) => {
      const next = new Set(prev);
      next.has(ip) ? next.delete(ip) : next.add(ip);
      return next;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Detected Anomalies ({anomalies.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No anomalies detected.</p>
        ) : (
          sorted.map((a, i) => (
            <AnomalyCard
              key={`${a.ip}-${i}`}
              anomaly={a}
              open={openIps.has(a.ip)}
              onToggle={() => toggle(a.ip)}
              onFilterIp={onFilterIp}
              flash={flashIp === a.ip}
              onFlashEnd={() => setFlashIp(null)}
              cardRef={(el) => {
                if (el) cardRefs.current.set(a.ip, el);
              }}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
