import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { query } from "../lib/db";
import { authMiddleware } from "../middleware/authMiddleware";
import { routeQuestion } from "../lib/queryRouter";
import { queryLogs, type StructuredResult } from "../lib/queryLogs";
import { buildChunks } from "../lib/ragChunks";
import { embedChunks, topKChunks, type EmbeddedChunk } from "../lib/embeddings";
import type { AnalysisResult, AskResponse, RagChunk } from "../types/analysis";

const router = Router();

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a SOC analyst assistant. Answer the user's question using ONLY the provided context drawn from a single log-analysis result. Cite the specific IPs and timestamps that appear in the context. If the answer is not present in the context, say so plainly ("That isn't covered by this analysis."). Be concise — 1-3 sentences.`;

type Source = AskResponse["sources"][number];

/** Lazily compute + cache the chunk embeddings for an analysis (semantic tiers only). */
async function getEmbeddedChunks(
  resultId: string,
  result: AnalysisResult,
  cached: EmbeddedChunk[] | null
): Promise<EmbeddedChunk[]> {
  if (cached && cached.length > 0) return cached;
  const embedded = await embedChunks(buildChunks(result));
  await query("UPDATE analysis_results SET embeddings = $1 WHERE id = $2", [
    JSON.stringify(embedded),
    resultId,
  ]);
  return embedded;
}

/** Deterministic, exact answer for a pure structured (Tier 1) question — no LLM. */
function answerStructured(
  res: StructuredResult,
  mentionsBreach: boolean
): { answer: string; sources: Source[] } {
  const sources: Source[] = res.anomalies.map((a) => ({
    type: "anomaly",
    ip: a.ip,
    text: a.reason + (a.breached ? ` (breached at ${a.breachTime})` : ""),
  }));

  if (mentionsBreach) {
    const breached = res.anomalies.filter((a) => a.breached);
    if (breached.length === 0)
      return { answer: "No successful breach was detected in this analysis.", sources };
    const list = breached
      .map((a) => `${a.ip} (at ${a.breachTime})`)
      .join(", ");
    return {
      answer: `${breached.length} IP(s) achieved a successful breach: ${list}.`,
      sources,
    };
  }

  if (res.totalMatches === 0)
    return { answer: "No log entries match that filter.", sources };

  const sample = res.entries
    .slice(0, 5)
    .map((e) => `${e.timestamp} ${e.method} ${e.url} -> ${e.status} (${e.ip})`)
    .join("\n");
  return {
    answer: `Found ${res.totalMatches} matching log entr${res.totalMatches === 1 ? "y" : "ies"}:\n${sample}${res.totalMatches > 5 ? "\n…" : ""}`,
    sources,
  };
}

/** Generate a grounded answer from context chunks via Claude, or extractive fallback. */
async function answerFromChunks(
  question: string,
  chunks: RagChunk[],
  structured?: StructuredResult
): Promise<string> {
  const contextLines = chunks.map((c) => `- ${c.text}`);
  if (structured && structured.totalMatches > 0) {
    contextLines.push(
      `- Matching log entries (${structured.totalMatches}): ` +
        structured.entries
          .slice(0, 8)
          .map((e) => `${e.method} ${e.url} -> ${e.status} from ${e.ip} at ${e.timestamp}`)
          .join("; ")
    );
  }
  const context = contextLines.join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Extractive fallback: return the most relevant passages directly.
    return context
      ? `Based on the analysis:\n${context}`
      : "That isn't covered by this analysis.";
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Question: ${question}\n\nContext:\n${context}` },
      ],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text || `Based on the analysis:\n${context}`;
  } catch (err) {
    console.error("ask generation failed, returning extractive answer:", err);
    return context ? `Based on the analysis:\n${context}` : "That isn't covered by this analysis.";
  }
}

// POST /api/ask  { result_id, question } -> { answer, mode, sources }
router.post("/", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const { result_id, question } = (req.body ?? {}) as {
      result_id?: string;
      question?: string;
    };
    if (!result_id || !question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "result_id and question are required" });
    }

    // Ownership check (via uploads) + load result and any cached embeddings.
    const row = await query<{ result: AnalysisResult; embeddings: EmbeddedChunk[] | null }>(
      `SELECT ar.result, ar.embeddings
         FROM analysis_results ar
         JOIN uploads u ON u.id = ar.upload_id
        WHERE ar.id = $1 AND u.user_id = $2`,
      [result_id, user.userId]
    );
    const record = row.rows[0];
    if (!record) return res.status(404).json({ error: "result not found" });

    const result = record.result;
    const q = routeQuestion(question);

    // Pure structured lookup — exact, no embeddings, no LLM.
    if (!q.isEmpty && !q.isConceptual) {
      const structured = queryLogs(result, q);
      const { answer, sources } = answerStructured(structured, Boolean(q.breachedOnly));
      const payload: AskResponse = { answer, mode: "structured", sources };
      return res.json(payload);
    }

    // Semantic or hybrid — both need the chunk embeddings.
    let embedded = await getEmbeddedChunks(result_id, result, record.embeddings);

    // Hybrid: narrow the semantic candidates to the structured subset (e.g. an IP).
    const hybrid = !q.isEmpty && q.isConceptual;
    let structured: StructuredResult | undefined;
    if (hybrid) {
      structured = queryLogs(result, q);
      if (q.ip) {
        const scoped = embedded.filter((c) => !c.ip || c.ip === q.ip);
        if (scoped.length > 0) embedded = scoped;
      }
    }

    const chunks = await topKChunks(question, embedded, 4);
    const answer = await answerFromChunks(question, chunks, structured);
    const sources: Source[] = chunks.map((c) => ({ type: c.type, ip: c.ip, text: c.text }));
    const payload: AskResponse = {
      answer,
      mode: hybrid ? "hybrid" : "semantic",
      sources,
    };
    return res.json(payload);
  } catch (err) {
    console.error("ask error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

export default router;
