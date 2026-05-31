import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function POST(req: Request) {
  try {
    const user = getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "no file provided" }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = `${randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const filePath = path.join(UPLOAD_DIR, safeName);
    await writeFile(filePath, bytes);

    const result = await query<{ id: string }>(
      "INSERT INTO uploads (user_id, filename, file_path) VALUES ($1, $2, $3) RETURNING id",
      [user.userId, file.name, filePath]
    );

    return NextResponse.json({ upload_id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    console.error("upload error:", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
