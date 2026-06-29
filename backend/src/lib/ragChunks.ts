import type { AnalysisResult, RagChunk } from "@/types/analysis";

/**
 * Turn an AnalysisResult into labeled, retrievable text passages for semantic
 * (Tier 2) search: the SOC summary, one chunk per anomaly, one per timeline
 * event, and a stats overview. Each chunk keeps `type`/`ip` so the answer can
 * cite its source and the UI can focus the matching anomaly.
 */
export function buildChunks(result: AnalysisResult): RagChunk[] {
  const chunks: RagChunk[] = [];

  if (result.summary?.trim()) {
    chunks.push({ id: "summary", type: "summary", text: result.summary.trim() });
  }

  result.anomalies.forEach((a, i) => {
    const breach = a.breached
      ? ` This IP achieved a successful login (breach) at ${a.breachTime}.`
      : "";
    chunks.push({
      id: `anomaly-${i}`,
      type: "anomaly",
      ip: a.ip,
      text:
        `Anomaly from IP ${a.ip} (confidence ${a.confidence.toFixed(2)}): ` +
        `${a.reason}.${breach}`,
    });
  });

  result.timeline.forEach((t, i) => {
    chunks.push({
      id: `timeline-${i}`,
      type: "timeline",
      text: `[${t.severity}] ${t.time}: ${t.event}`,
    });
  });

  const sb = Object.entries(result.stats.statusBreakdown)
    .map(([code, n]) => `${code}: ${n}`)
    .join(", ");
  chunks.push({
    id: "stats",
    type: "stats",
    text:
      `Overall stats — ${result.stats.total} requests from ` +
      `${result.stats.uniqueIPs} unique IPs over ${result.stats.timeRange}. ` +
      `Status breakdown: ${sb}.`,
  });

  return chunks;
}
