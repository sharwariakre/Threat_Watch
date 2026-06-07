import Anthropic from "@anthropic-ai/sdk";
import type {
  AnalysisResult,
  Anomaly,
  LogEntry,
  ParsedLogs,
  Severity,
  TimelineEvent,
} from "@/types/analysis";
import { detectBreach } from "./logParser";

/**
 * Layer 2 — Claude API analysis.
 *
 * Receives the *pre-parsed* structured JSON + stats from logParser (NOT raw log
 * text), makes a single API call, then validates the JSON response before it is
 * returned for storage.
 */

// Latest Sonnet available on this account. Override with ANTHROPIC_MODEL if you
// have access to a different model (e.g. claude-sonnet-4-5-20250929, claude-opus-4-8).
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a senior SOC (Security Operations Center) analyst. You are given pre-parsed web/proxy access log data as structured JSON together with computed statistics. Your job is to triage it like an L2 analyst writing an incident note.

Return ONLY a JSON object (no markdown, no prose outside the JSON) with this exact shape:
{
  "summary": "3-sentence SOC narrative describing what this traffic looks like and the top concern",
  "timeline": [{ "time": "ISO timestamp", "event": "short description", "severity": "high|medium|low" }],
  "anomalies": [{ "ip": "1.2.3.4", "reason": "why this is suspicious", "confidence": 0.0-1.0 }]
}

Rules:
- summary must be exactly 3 sentences.
- timeline: 4-8 notable events, sorted chronologically.
- anomalies: focus on the most suspicious IPs (brute force / scanning / traversal / errors / abnormal volume). confidence is your calibrated certainty 0..1.
- Reference the provided stats (requestsPerIP, statusBreakdown, requestsPerMinute, authFailuresPerIP, bruteForceIPs) in your reasoning.
- Any IP in bruteForceIPs is a likely brute-force/credential-stuffing source (repeated 401s in a short window) — always include it as an anomaly with confidence >= 0.85.`;

function buildUserPayload(parsed: ParsedLogs): string {
  // Cap the per-entry sample so we don't blow the context window on huge files;
  // the stats already summarize the whole dataset.
  const sampleEntries = parsed.entries.slice(0, 200);
  return JSON.stringify(
    {
      stats: parsed.stats,
      sampleEntryCount: sampleEntries.length,
      totalEntryCount: parsed.entries.length,
      entries: sampleEntries,
    },
    null,
    2
  );
}

function clampConfidence(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (isNaN(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

function coerceSeverity(s: unknown): Severity {
  return s === "high" || s === "medium" || s === "low" ? s : "low";
}

/** Attach the deterministic related log entries to each Claude-reported anomaly. */
function attachRelatedEntries(
  anomalies: { ip: string; reason: string; confidence: number }[],
  entries: LogEntry[]
): Anomaly[] {
  return anomalies.map((a) => ({
    ip: a.ip,
    reason: a.reason,
    confidence: a.confidence,
    relatedEntries: entries.filter((e) => e.ip === a.ip).slice(0, 50),
  }));
}

/**
 * Deterministic brute-force anomalies derived from the parser's stats. These are
 * surfaced regardless of whether Claude flags them, so a clear brute-force
 * pattern (repeated 401s from one IP) always appears in the AnomaliesPanel.
 */
function bruteForceAnomalies(parsed: ParsedLogs): Anomaly[] {
  return parsed.stats.bruteForceIPs.map((ip) => {
    const related = parsed.entries.filter((e) => e.ip === ip);
    const failures = related.filter((e) => e.status === 401);
    const count = parsed.stats.authFailuresPerIP[ip] ?? failures.length;

    const times = failures
      .map((e) => new Date(e.timestamp).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);
    const spanSec =
      times.length > 1 ? Math.round((times[times.length - 1] - times[0]) / 1000) : 0;
    const window =
      spanSec > 120
        ? `in ${Math.round(spanSec / 60)} minutes`
        : "in under 2 minutes";

    // 0.85 floor, climbing with the number of failures.
    const confidence = Math.min(0.99, 0.85 + Math.max(0, count - 5) * 0.01);

    return {
      ip,
      reason: `${count} failed login attempts from single IP ${window}`,
      confidence,
      relatedEntries: related.slice(0, 50),
    };
  });
}

/** Merge brute-force anomalies in, preferring the deterministic entry per IP. */
function mergeBruteForce(base: Anomaly[], bruteForce: Anomaly[]): Anomaly[] {
  const bfIPs = new Set(bruteForce.map((a) => a.ip));
  const rest = base.filter((a) => !bfIPs.has(a.ip));
  return [...bruteForce, ...rest];
}

function extractJson(text: string): unknown {
  // Tolerate ```json fences or stray prose around the object.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Deterministic fallback used when ANTHROPIC_API_KEY is missing or the call
 * fails — keeps the whole pipeline functional with mock-but-real analysis.
 */
function fallbackAnalysis(parsed: ParsedLogs): AnalysisResult {
  const flagged = parsed.entries.filter((e) => e.flagged);
  const bfIPs = new Set(parsed.stats.bruteForceIPs);
  const byIp: Record<string, LogEntry[]> = {};
  // Brute-force IPs get their own dedicated anomaly below — don't double-report.
  for (const e of flagged) {
    if (bfIPs.has(e.ip)) continue;
    (byIp[e.ip] ??= []).push(e);
  }

  const otherAnomalies: Anomaly[] = Object.entries(byIp)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([ip, related]) => {
      const count = parsed.stats.requestsPerIP[ip] ?? related.length;
      const has5xx = related.some((e) => e.status >= 500);
      const hasTraversal = related.some((e) =>
        /(\.\.\/|etc\/passwd|admin)/i.test(e.url)
      );
      const reasons: string[] = [];
      if (count >= 20) reasons.push(`high request volume (${count} requests)`);
      if (has5xx) reasons.push("triggered server (5xx) errors");
      if (hasTraversal) reasons.push("path traversal / sensitive path access");
      return {
        ip,
        reason: reasons.join("; ") || "flagged by heuristics",
        confidence: Math.min(0.95, 0.5 + related.length * 0.05),
        relatedEntries: related.slice(0, 50),
      };
    });

  // Brute-force first (highest signal), then the other heuristic findings.
  const anomalies: Anomaly[] = [
    ...bruteForceAnomalies(parsed),
    ...otherAnomalies,
  ];

  const timeline: TimelineEvent[] = flagged
    .slice(0, 8)
    .map((e) => ({
      time: e.timestamp,
      event: `${e.method} ${e.url} -> ${e.status} from ${e.ip}`,
      severity: (e.status >= 500
        ? "high"
        : /(\.\.\/|etc\/passwd|admin)/i.test(e.url)
          ? "high"
          : "medium") as Severity,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  return {
    summary: `Deterministic heuristic analysis of ${parsed.stats.total} requests across ${parsed.stats.uniqueIPs} unique IPs (no Claude API key configured). ${anomalies.length} suspicious source IP(s) were flagged based on volume, error rates, and suspicious URL patterns. Configure ANTHROPIC_API_KEY to enable full AI-driven SOC narrative and timeline.`,
    timeline,
    anomalies,
    stats: {
      total: parsed.stats.total,
      uniqueIPs: parsed.stats.uniqueIPs,
      timeRange: parsed.stats.timeRange,
      statusBreakdown: parsed.stats.statusBreakdown,
    },
    entries: parsed.entries,
    ...detectBreach(parsed.entries, new Set(parsed.stats.bruteForceIPs)),
  };
}

export async function analyzeWithClaude(
  parsed: ParsedLogs
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallbackAnalysis(parsed);
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPayload(parsed) }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const raw = extractJson(text) as {
      summary?: string;
      timeline?: unknown[];
      anomalies?: unknown[];
    };

    const timeline: TimelineEvent[] = Array.isArray(raw.timeline)
      ? raw.timeline.map((t) => {
          const ev = t as Record<string, unknown>;
          return {
            time: String(ev.time ?? ""),
            event: String(ev.event ?? ""),
            severity: coerceSeverity(ev.severity),
          };
        })
      : [];

    const rawAnomalies = Array.isArray(raw.anomalies)
      ? raw.anomalies.map((a) => {
          const an = a as Record<string, unknown>;
          return {
            ip: String(an.ip ?? "unknown"),
            reason: String(an.reason ?? ""),
            confidence: clampConfidence(an.confidence),
          };
        })
      : [];

    return {
      summary:
        typeof raw.summary === "string" && raw.summary.trim()
          ? raw.summary
          : "Analysis completed but no summary was returned.",
      timeline,
      anomalies: mergeBruteForce(
        attachRelatedEntries(rawAnomalies, parsed.entries),
        bruteForceAnomalies(parsed)
      ),
      stats: {
        total: parsed.stats.total,
        uniqueIPs: parsed.stats.uniqueIPs,
        timeRange: parsed.stats.timeRange,
        statusBreakdown: parsed.stats.statusBreakdown,
      },
      entries: parsed.entries,
      ...detectBreach(parsed.entries, new Set(parsed.stats.bruteForceIPs)),
    };
  } catch (err) {
    console.error("Claude analysis failed, falling back to heuristics:", err);
    return fallbackAnalysis(parsed);
  }
}
