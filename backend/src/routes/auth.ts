import { Router } from "express";
import { query } from "../lib/db";
import { hashPassword, verifyPassword, signToken, setAuthCookie } from "../lib/auth";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "email already registered" });
    }

    const passwordHash = await hashPassword(password);
    const result = await query<{ id: string; email: string }>(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, passwordHash]
    );

    const user = result.rows[0];
    setAuthCookie(res, signToken({ userId: user.id, email: user.email }));

    return res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const result = await query<{ id: string; email: string; password_hash: string }>(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    setAuthCookie(res, signToken({ userId: user.id, email: user.email }));

    return res.json({ id: user.id, email: user.email });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

export default router;
