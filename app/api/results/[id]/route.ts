import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { AnalysisResult } from "@/types/analysis";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Join through uploads to enforce ownership.
    const res = await query<{ result: AnalysisResult }>(
      `SELECT ar.result
         FROM analysis_results ar
         JOIN uploads u ON u.id = ar.upload_id
        WHERE ar.id = $1 AND u.user_id = $2`,
      [params.id, user.userId]
    );

    const row = res.rows[0];
    if (!row) {
      return NextResponse.json({ error: "result not found" }, { status: 404 });
    }

    // result is JSONB — pg already deserializes it into an object.
    return NextResponse.json(row.result);
  } catch (err) {
    console.error("results error:", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
