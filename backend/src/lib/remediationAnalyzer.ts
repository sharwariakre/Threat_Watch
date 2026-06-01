import Anthropic from "@anthropic-ai/sdk";
import type { Anomaly, LogEntry, Playbook, PlaybookStep } from "../types/analysis";

/*
 * Remediation playbook generator.
 *
 * WHAT CLAUDE IS ASKED TO DO:
 *   Act as a SOC incident responder and, for each confirmed anomaly, produce a
 *   concrete remediation checklist (4-6 steps) tailored to that *specific* attack
 *   — referencing the real IPs, URLs, timestamps and payloads in the data rather
 *   than emitting generic security advice. Each step is tagged immediate /
 *   short-term / long-term so an analyst can triage what to do first.
 *
 * WHY THIS IS A SEPARATE CALL FROM claudeAnalyzer.ts:
 *   The main analysis (claudeAnalyzer.ts) answers "what happened?" — it returns
 *   the summary, timeline and anomalies that get persisted as the AnalysisResult.
 *   This call answers a different question: "what should we do about it?". Keeping
 *   them apart means:
 *     - the triage prompt stays focused and isn't bloated with response guidance;
 *     - remediation can be (re)generated or skipped on its own, on demand from the
 *       results page, without re-running or invalidating the stored analysis;
 *     - a failure or slow response here can never corrupt or block the main
 *       AnalysisResult — the dashboard simply degrades to "Remediation unavailable".
 *   It runs ONCE with every anomaly batched into a single request.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a SOC incident responder. For each of the following confirmed anomalies, generate a specific remediation playbook. Each playbook must contain 4-6 concrete steps tailored to the exact attack observed — reference the actual IPs, URLs, timestamps, and payloads from the data. Do not give generic advice. Classify each step as immediate (do right now), short-term (within 24 hours), or long-term (within a week).

Return ONLY a JSON array of playbooks matching this shape:
[{
  "ip": string,
  "attackType": string,
  "steps": [{ "step": number, "action": string, "priority": "immediate" | "short-term" | "long-term" }]
}]`;

function buildUserPayload(anomalies: Anomaly[], entries: LogEntry[]): string {
  // Each anomaly already carries its related log lines (URLs/timestamps/payloads);
  // include a capped global entry sample for extra context without blowing context.
  const slimAnomalies = anomalies.map((a) => ({
    ip: a.ip,
    reason: a.reason,
    confidence: a.confidence,
    relatedEntries: a.relatedEntries.slice(0, 30),
  }));
  return JSON.stringify(
    {
      anomalies: slimAnomalies,
      contextEntries: entries.slice(0, 100),
    },
    null,
    2
  );
}

function coercePriority(p: unknown): PlaybookStep["priority"] {
  return p === "immediate" || p === "short-term" || p === "long-term"
    ? p
    : "short-term";
}

function validatePlaybooks(raw: unknown): Playbook[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const pb = p as Record<string, unknown>;
    const stepsRaw = Array.isArray(pb.steps) ? pb.steps : [];
    const steps: PlaybookStep[] = stepsRaw.map((s, i) => {
      const st = s as Record<string, unknown>;
      return {
        step: typeof st.step === "number" ? st.step : i + 1,
        action: String(st.action ?? ""),
        priority: coercePriority(st.priority),
      };
    });
    return {
      ip: String(pb.ip ?? "unknown"),
      attackType: String(pb.attackType ?? "Anomaly"),
      steps,
    };
  });
}

/**
 * Generate one remediation playbook per anomaly. Returns [] (never throws) when
 * no API key is configured or the Claude call fails, so the caller can degrade
 * gracefully to a "Remediation unavailable" state.
 */
export async function generateRemediationPlaybooks(
  anomalies: Anomaly[],
  entries: LogEntry[]
): Promise<Playbook[]> {
  if (anomalies.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      // Generous budget: one playbook per anomaly with 4-6 detailed steps each
      // can be large; too small a limit truncates the JSON and breaks parsing.
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPayload(anomalies, entries) }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Log exactly what Claude returned so empty-playbook issues are debuggable.
    console.log("[remediation] raw Claude response:\n" + text);

    // Claude sometimes wraps the JSON array in ```json ... ``` fences — strip them.
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: pull the array out from the first "[" to the last "]".
      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");
      if (start === -1 || end === -1) {
        console.error("[remediation] no JSON array found in response");
        return [];
      }
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch (e) {
        console.error("[remediation] JSON.parse failed:", e);
        return [];
      }
    }

    if (!Array.isArray(parsed)) {
      console.error("[remediation] parsed result is not an array:", parsed);
      return [];
    }

    return validatePlaybooks(parsed);
  } catch (err) {
    console.error("remediation generation failed:", err);
    return [];
  }
}
