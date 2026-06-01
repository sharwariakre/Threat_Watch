import { Router } from "express";
import { readFile } from "fs/promises";
import { query } from "../lib/db";
import { authMiddleware } from "../middleware/authMiddleware";
import { parseLogs } from "../lib/logParser";
import { analyzeWithClaude } from "../lib/claudeAnalyzer";

const router = Router();

// POST /api/analyze  { upload_id }
router.post("/", authMiddleware, async (req, res) => {
  try {
    const user = req.user!;
    const { upload_id } = req.body ?? {};
    if (!upload_id) {
      return res.status(400).json({ error: "upload_id is required" });
    }

    const uploadRes = await query<{ file_path: string }>(
      "SELECT file_path FROM uploads WHERE id = $1 AND user_id = $2",
      [upload_id, user.userId]
    );
    const upload = uploadRes.rows[0];
    if (!upload) {
      return res.status(404).json({ error: "upload not found" });
    }

    const raw = await readFile(upload.file_path, "utf-8");

    // Layer 1: deterministic parse + stats
    const parsed = parseLogs(raw);
    // Layer 2: Claude analysis (falls back to heuristics if no API key)
    const analysis = await analyzeWithClaude(parsed);

    const result = await query<{ id: string }>(
      "INSERT INTO analysis_results (upload_id, result) VALUES ($1, $2) RETURNING id",
      [upload_id, JSON.stringify(analysis)]
    );

    return res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error("analyze error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

export default router;
