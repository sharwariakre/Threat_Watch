"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SOCSummaryCard } from "@/components/SOCSummaryCard";
import { StatsBar } from "@/components/StatsBar";
import { TimelinePanel } from "@/components/TimelinePanel";
import { AnomaliesPanel, type AnomalyFocus } from "@/components/AnomaliesPanel";
import { TrafficChart } from "@/components/TrafficChart";
import { TopAttackingIPs } from "@/components/TopAttackingIPs";
import { BruteForceBanner } from "@/components/BruteForceBanner";
import { RemediationPlaybook } from "@/components/RemediationPlaybook";
import { LogTable, type LogFilters } from "@/components/LogTable";
import { mockAnalysis } from "@/lib/mockData";
import { apiUrl } from "@/lib/api";
import type { AnalysisResult, Playbook } from "@/types/analysis";

export default function ResultsPage({ params }: { params: { id: string } }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  // Remediation playbooks come from a separate, on-demand Claude call. Failures
  // here must never break the rest of the dashboard.
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [remediationLoading, setRemediationLoading] = useState(false);
  const [remediationFailed, setRemediationFailed] = useState(false);

  // --- interactive dashboard state (lifted up) ---
  const [activeTab, setActiveTab] = useState<"overview" | "remediation">("overview");
  const [filters, setFilters] = useState<LogFilters>({ ip: "", status: "" });
  const [focus, setFocus] = useState<AnomalyFocus | null>(null);
  const focusNonce = useRef(0);

  const anomaliesRef = useRef<HTMLDivElement>(null);
  const logTableRef = useRef<HTMLDivElement>(null);
  const topIPsRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLElement>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Scroll to + optionally expand/flash a specific anomaly card (on Overview).
  const focusAnomaly = (ip: string, opts: { expand?: boolean; flash?: boolean }) => {
    focusNonce.current += 1;
    setActiveTab("overview");
    setFocus({
      ip,
      expand: opts.expand ?? false,
      flash: opts.flash ?? false,
      nonce: focusNonce.current,
    });
  };

  const filterLogsByIp = (ip: string) => {
    setActiveTab("overview");
    setFilters((f) => ({ ...f, ip }));
    scrollTo(logTableRef);
  };
  const filterLogsByStatus = (status: string) => {
    setActiveTab("overview");
    setFilters((f) => ({ ...f, status }));
    scrollTo(logTableRef);
  };

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

  // Second pass: once we have a real analysis with anomalies, ask the backend to
  // generate remediation playbooks. Skipped for mock data (no backend reachable).
  useEffect(() => {
    if (!result || result.anomalies.length === 0) return;
    if (usingMock) {
      setRemediationFailed(true);
      return;
    }

    let active = true;
    setRemediationLoading(true);
    setRemediationFailed(false);
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/remediation"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            result_id: params.id,
            anomalies: result.anomalies,
            entries: result.entries,
          }),
        });
        if (!res.ok) throw new Error("not ok");
        const data = (await res.json()) as { playbooks: Playbook[] };
        if (active) setPlaybooks(Array.isArray(data.playbooks) ? data.playbooks : []);
      } catch {
        if (active) setRemediationFailed(true);
      } finally {
        if (active) setRemediationLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [result, usingMock]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading analysis…
      </div>
    );
  }

  if (!result) return null;

  const anomalyIps = result.anomalies.map((a) => a.ip);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "overview" | "remediation")}
      className="space-y-6"
    >
      {/* Tab bar — below the navbar, above the critical banner */}
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="remediation">Remediation</TabsTrigger>
      </TabsList>

      {/* Critical banner shows on BOTH tabs (outside tab content) */}
      <BruteForceBanner result={result} />

      {usingMock && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          <AlertCircle className="h-4 w-4" />
          Showing mock data — the API/database isn&apos;t connected for this result.
        </div>
      )}

      <TabsContent
        forceMount
        value="overview"
        className={activeTab === "overview" ? "mt-0 space-y-6" : "hidden"}
      >
        <StatsBar
          result={result}
          onAnomaliesClick={() => scrollTo(anomaliesRef)}
          onTotalClick={() => scrollTo(logTableRef)}
          onUniqueIPsClick={() => scrollTo(topIPsRef)}
        />
        <SOCSummaryCard summary={result.summary} />
        <TrafficChart result={result} onStatusSelect={filterLogsByStatus} />

        <div ref={topIPsRef}>
          <TopAttackingIPs
            anomalies={result.anomalies}
            onSelectIp={(ip) => focusAnomaly(ip, { expand: true })}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <TimelinePanel
            events={result.timeline}
            anomalyIps={anomalyIps}
            onSelectIp={(ip) => focusAnomaly(ip, { flash: true })}
          />
          <div ref={anomaliesRef}>
            <AnomaliesPanel
              anomalies={result.anomalies}
              onFilterIp={filterLogsByIp}
              focus={focus}
            />
          </div>
        </div>

        <div ref={logTableRef}>
          <LogTable
            entries={result.entries}
            filters={filters}
            onFiltersChange={setFilters}
            anomalies={result.anomalies}
            onViewAnomaly={(ip) => focusAnomaly(ip, { flash: true })}
          />
        </div>
      </TabsContent>

      <TabsContent
        forceMount
        value="remediation"
        className={activeTab === "remediation" ? "mt-0" : "hidden"}
      >
        {result.anomalies.length > 0 ? (
          <RemediationPlaybook
            playbooks={playbooks}
            loading={remediationLoading}
            failed={remediationFailed}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No anomalies detected — nothing to remediate.
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}
