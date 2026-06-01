"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { SOCSummaryCard } from "@/components/SOCSummaryCard";
import { StatsBar } from "@/components/StatsBar";
import { TimelinePanel } from "@/components/TimelinePanel";
import { AnomaliesPanel } from "@/components/AnomaliesPanel";
import { TrafficChart } from "@/components/TrafficChart";
import { TopAttackingIPs } from "@/components/TopAttackingIPs";
import { BruteForceBanner } from "@/components/BruteForceBanner";
import { LogTable } from "@/components/LogTable";
import { mockAnalysis } from "@/lib/mockData";
import { apiUrl } from "@/lib/api";
import type { AnalysisResult } from "@/types/analysis";

export default function ResultsPage({ params }: { params: { id: string } }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/results/${params.id}`), {
          credentials: "include",
        });
        if (!res.ok) throw new Error("not ok");
        const data = (await res.json()) as AnalysisResult;
        if (active) setResult(data);
      } catch {
        // API/DB not connected — fall back to mock data so the dashboard renders.
        if (active) {
          setResult(mockAnalysis);
          setUsingMock(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading analysis…
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6">
      <BruteForceBanner result={result} />

      {usingMock && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          <AlertCircle className="h-4 w-4" />
          Showing mock data — the API/database isn&apos;t connected for this result.
        </div>
      )}

      <StatsBar result={result} />
      <SOCSummaryCard summary={result.summary} />
      <TrafficChart result={result} />

      <TopAttackingIPs anomalies={result.anomalies} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TimelinePanel events={result.timeline} />
        <AnomaliesPanel anomalies={result.anomalies} />
      </div>

      <LogTable entries={result.entries} />
    </div>
  );
}
