import { Router } from "express";
import { query } from "../lib/db";
import { authMiddleware } from "../middleware/authMiddleware";
import { generateRemediationPlaybooks } from "../lib/remediationAnalyzer";
import type { Anomaly, LogEntry, Playbook } from "../types/analysis";

const router = Router();

// POST /api/remediation  { result_id, anomalies, entries } -> { playbooks }
//
// Playbooks are cached per analysis: the first successful generation is stored in
// analysis_results.playbook, and subsequent requests for the same result_id return
// the cached copy without calling Claude again.
router.post("/", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const { result_id, anomalies, entries } = (req.body ?? {}) as {
      result_id?: string;
      anomalies?: Anomaly[];
      entries?: LogEntry[];
    };

    if (!result_id) {
      return res.status(400).json({ error: "result_id is required" });
    }
    if (!Array.isArray(anomalies)) {
      return res.status(400).json({ error: "anomalies array is required" });
    }

    // Verify ownership (via uploads) and read any cached playbook in one query.
    const existing = await query<{ playbook: Playbook[] | null }>(
      `SELECT ar.playbook
         FROM analysis_results ar
         JOIN uploads u ON u.id = ar.upload_id
        WHERE ar.id = $1 AND u.user_id = $2`,
      [result_id, user.userId]
    );

    const row = existing.rows[0];
    if (!row) {
      return res.status(404).json({ error: "result not found" });
    }

    // Cache hit — return stored playbooks, skip Claude entirely.
    if (row.playbook && row.playbook.length > 0) {
      return res.json({ playbooks: row.playbook });
    }

    // Cache miss — generate, then persist only if we actually got playbooks. A
    // keyless/failed empty result is NOT cached, so it can be retried later.
    const playbooks = await generateRemediationPlaybooks(
      anomalies,
      Array.isArray(entries) ? entries : []
    );

    if (playbooks.length > 0) {
      await query("UPDATE analysis_results SET playbook = $1 WHERE id = $2", [
        JSON.stringify(playbooks),
        result_id,
      ]);
    }

    return res.json({ playbooks });
  } catch (err) {
    console.error("remediation error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

export default router;
