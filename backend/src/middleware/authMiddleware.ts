import type { Request, Response, NextFunction } from "express";
import { verifyToken, COOKIE_NAME, type JwtPayload } from "../lib/auth";

// Augment Express's Request so handlers can read req.user after this middleware.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Verify the JWT auth cookie and attach the decoded user to the request. */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  req.user = user;
  next();
}
