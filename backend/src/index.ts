import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth";
import uploadRoutes from "./routes/upload";
import analyzeRoutes from "./routes/analyze";
import resultsRoutes from "./routes/results";
import remediationRoutes from "./routes/remediation";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Allow localhost (dev) and the deployed frontend (FRONTEND_URL, set on Railway).
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL || "",
].filter(Boolean);

// Allow the Next.js frontend to send/receive the httpOnly auth cookie.
app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser clients (curl, server-to-server) send no Origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/analyze", analyzeRoutes);
app.use("/api/results", resultsRoutes);
app.use("/api/remediation", remediationRoutes);

app.listen(PORT, () => {
  console.log(`Backend API listening on port ${PORT}`);
  console.log(`CORS origins allowed: ${allowedOrigins.join(", ")}`);
});
