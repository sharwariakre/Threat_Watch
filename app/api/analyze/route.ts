import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseLogs } from "@/lib/logParser";
import { analyzeWithClaude } from "@/lib/claudeAnalyzer";

export async function POST(req: Request) {
  try {
    const user = getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { upload_id } = await req.json();
    if (!upload_id) {
      return NextResponse.json({ error: "upload_id is required" }, { status: 400 });
    }

    const uploadRes = await query<{ file_path: string }>(
      "SELECT file_path FROM uploads WHERE id = $1 AND user_id = $2",
      [upload_id, user.userId]
    );
    const upload = uploadRes.rows[0];
    if (!upload) {
      return NextResponse.json({ error: "upload not found" }, { status: 404 });
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

    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    console.error("analyze error:", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
