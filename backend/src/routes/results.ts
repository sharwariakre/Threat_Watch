import { Router } from "express";
import { query } from "../lib/db";
import { authMiddleware } from "../middleware/authMiddleware";
import type { AnalysisResult } from "../types/analysis";

const router = Router();

// GET /api/results/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;

    // Join through uploads to enforce ownership.
    const result = await query<{ result: AnalysisResult }>(
      `SELECT ar.result
         FROM analysis_results ar
         JOIN uploads u ON u.id = ar.upload_id
        WHERE ar.id = $1 AND u.user_id = $2`,
      [req.params.id, user.userId]
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: "result not found" });
    }

    // result is JSONB — pg already deserializes it into an object.
    return res.json(row.result);
  } catch (err) {
    console.error("results error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

export default router;
