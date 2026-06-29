import type { AnalysisResult, LogEntry, Anomaly, LogQuery } from "@/types/analysis";

/**
 * Tier 1 — deterministic structured query over an AnalysisResult.
 *
 * Applies the filters extracted by queryRouter directly to the already-structured
 * entries/anomalies. Exact, fast, no embeddings, no LLM. This is what answers
 * "logs from 198.51.100.30", "show the 401s", "which IPs breached".
 */

export interface StructuredResult {
  entries: LogEntry[];
  anomalies: Anomaly[];
  totalMatches: number;
}

const MAX_ENTRIES = 50;

export function queryLogs(result: AnalysisResult, query: LogQuery): StructuredResult {
  let entries = result.entries;

  if (query.ip) entries = entries.filter((e) => e.ip === query.ip);
  if (query.statuses?.length)
    entries = entries.filter((e) => query.statuses!.includes(e.status));
  if (query.methods?.length)
    entries = entries.filter((e) => query.methods!.includes(e.method.toUpperCase()));
  if (query.urlContains)
    entries = entries.filter((e) => e.url.includes(query.urlContains!));
  if (query.flaggedOnly) entries = entries.filter((e) => e.flagged);

  // Anomalies relevant to the same filters (IP match, or breached-only intent).
  let anomalies = result.anomalies;
  if (query.breachedOnly) anomalies = anomalies.filter((a) => a.breached);
  if (query.ip) anomalies = anomalies.filter((a) => a.ip === query.ip);

  // For a breach-only question, the entries of interest are the breached IPs'.
  if (query.breachedOnly && !query.ip) {
    const breachedIps = new Set(anomalies.map((a) => a.ip));
    entries = result.entries.filter((e) => breachedIps.has(e.ip));
  }

  return {
    entries: entries.slice(0, MAX_ENTRIES),
    anomalies,
    totalMatches: entries.length,
  };
}
