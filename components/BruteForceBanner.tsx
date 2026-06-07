"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";

/**
 * Presentation-only banner for a successful brute-force breach.
 *
 * All detection now happens deterministically in the backend
 * (backend/src/lib/logParser.ts -> detectBreach) and is surfaced as the
 * structured breachDetected / breachIp / breachTime fields on AnalysisResult.
 * This component does no detection — it only renders what the backend reports.
 */
/** Extract a wall-clock HH:MM:SS for display from the full ISO timestamp. */
function formatBreachTime(iso?: string): string {
  if (!iso) return "";
  const m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : iso;
}

export function BruteForceBanner({ result }: { result: AnalysisResult }) {
  const [dismissed, setDismissed] = useState(false);

  if (!result.breachDetected || dismissed) return null;

  const breachTime = formatBreachTime(result.breachTime);

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-md bg-red-600 px-4 py-3 font-bold text-white shadow-lg"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span className="flex-1 text-sm sm:text-base">
        ⚠ Critical: Brute force attack succeeded — {result.breachIp} gained
        unauthorized access at {breachTime}. Immediate action required.
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
