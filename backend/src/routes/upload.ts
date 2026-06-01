import { Router } from "express";
import multer from "multer";
import { mkdirSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { query } from "../lib/db";
import { authMiddleware } from "../middleware/authMiddleware";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) =>
    cb(null, `${randomUUID()}-${file.originalname.replace(/[^\w.\-]/g, "_")}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// POST /api/upload  (multipart, field name "file")
router.post("/", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const user = req.user!;
    if (!req.file) {
      return res.status(400).json({ error: "no file provided" });
    }

    const result = await query<{ id: string }>(
      "INSERT INTO uploads (user_id, filename, file_path) VALUES ($1, $2, $3) RETURNING id",
      [user.userId, req.file.originalname, req.file.path]
    );

    return res.status(201).json({ upload_id: result.rows[0].id });
  } catch (err) {
    console.error("upload error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

export default router;
