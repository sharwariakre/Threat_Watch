import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    const result = await query<{ id: string; email: string; password_hash: string }>(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
    }

    setAuthCookie(signToken({ userId: user.id, email: user.email }));

    return NextResponse.json({ id: user.id, email: user.email });
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
