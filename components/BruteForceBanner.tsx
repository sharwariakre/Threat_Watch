"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";

/**
 * Detect a *successful* brute-force attack: a high-confidence brute-force anomaly
 * whose IP has a streak of 401s that ends in a 200 (the attacker got in).
 * Returns the offending IP + the wall-clock time of the successful 200, or null.
 */
function detectBruteForceSuccess(
  result: AnalysisResult
): { ip: string; time: string } | null {
  const anomaly = result.anomalies.find((a) => {
    const reason = a.reason.toLowerCase();
    return (
      a.confidence > 0.9 &&
      (reason.includes("brute force") || reason.includes("login attempts"))
    );
  });
  if (!anomaly) return null;

  const ipEntries = result.entries
    .filter((e) => e.ip === anomaly.ip)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let seen401 = false;
  for (const entry of ipEntries) {
    if (entry.status === 401) {
      seen401 = true;
    } else if (entry.status === 200 && seen401) {
      // streak of 401s followed by a successful 200 from the same IP
      const m = entry.timestamp.match(/T(\d{2}:\d{2}:\d{2})/);
      return { ip: anomaly.ip, time: m ? m[1] : entry.timestamp };
    }
  }
  return null;
}

export function BruteForceBanner({ result }: { result: AnalysisResult }) {
  const [dismissed, setDismissed] = useState(false);
  const hit = detectBruteForceSuccess(result);

  if (!hit || dismissed) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-md bg-red-600 px-4 py-3 font-bold text-white shadow-lg"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span className="flex-1 text-sm sm:text-base">
        ⚠ Critical: Brute force attack succeeded — {hit.ip} gained unauthorized
        access at {hit.time}. Immediate action required.
      </span>
      <button
        type="button"
        aria-label="Dismiss alert"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 text-white/90 hover:bg-white/20 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
