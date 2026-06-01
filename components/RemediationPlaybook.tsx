"use client";

import { useState } from "react";
import { Loader2, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { classifyAttack } from "@/lib/attackClassification";
import { cn } from "@/lib/utils";
import type { Playbook, PlaybookStep } from "@/types/analysis";

const PRIORITY: Record<
  PlaybookStep["priority"],
  { label: string; variant: "red" | "medium" | "gray" }
> = {
  immediate: { label: "Immediate", variant: "red" },
  "short-term": { label: "Short-term", variant: "medium" },
  "long-term": { label: "Long-term", variant: "gray" },
};

function PlaybookCard({ playbook }: { playbook: Playbook }) {
  // In-memory checkbox state, keyed by step number. No persistence.
  const [done, setDone] = useState<Set<number>>(new Set());
  const attack = classifyAttack(playbook.attackType);

  const toggle = (step: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      next.has(step) ? next.delete(step) : next.add(step);
      return next;
    });

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-sm font-bold">{playbook.ip}</span>
        <Badge variant={attack.variant}>{playbook.attackType}</Badge>
      </div>

      <ol className="space-y-2">
        {playbook.steps.map((s) => {
          const pr = PRIORITY[s.priority];
          const checked = done.has(s.step);
          return (
            <li key={s.step} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(s.step)}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                aria-label={`Mark step ${s.step} done`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {s.step}.
                  </span>
                  <Badge variant={pr.variant}>{pr.label}</Badge>
                </div>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    checked && "text-muted-foreground line-through"
                  )}
                >
                  {s.action}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function RemediationPlaybook({
  playbooks,
  loading,
  failed,
}: {
  playbooks: Playbook[];
  loading: boolean;
  failed: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-5 w-5 text-primary" />
          Remediation Playbooks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating attack-specific remediation steps…
            </p>
            {[0, 1].map((i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-border p-4"
              >
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : failed || playbooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Remediation unavailable.
          </p>
        ) : (
          <div className="space-y-3">
            {playbooks.map((p, i) => (
              <PlaybookCard key={`${p.ip}-${i}`} playbook={p} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
