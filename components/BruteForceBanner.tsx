"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";

/**
 * Presentation-only banners for successful brute-force breaches.
 *
 * All detection now happens deterministically in the backend
 * (backend/src/lib/logParser.ts -> detectBreaches) and is surfaced per-IP via the
 * `breached` / `breachTime` fields on each Anomaly. This component does no
 * detection — it renders one banner per breached anomaly, each dismissible on
 * its own.
 */
/** Extract a wall-clock HH:MM:SS for display from the full ISO timestamp. */
function formatBreachTime(iso?: string): string {
  if (!iso) return "";
  const m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : iso;
}

export function BruteForceBanner({ result }: { result: AnalysisResult }) {
  const [dismissedIps, setDismissedIps] = useState<Set<string>>(new Set());

  const breached = result.anomalies.filter(
    (a) => a.breached && !dismissedIps.has(a.ip)
  );

  if (breached.length === 0) return null;

  const dismiss = (ip: string) =>
    setDismissedIps((prev) => new Set(prev).add(ip));

  return (
    <div className="flex flex-col gap-2">
      {breached.map((a) => (
        <div
          key={a.ip}
          role="alert"
          className="flex items-center gap-3 rounded-md bg-red-600 px-4 py-3 font-bold text-white shadow-lg"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-sm sm:text-base">
            ⚠ Critical: Brute force attack succeeded — {a.ip} gained unauthorized
            access at {formatBreachTime(a.breachTime)}. Immediate action required.
          </span>
          <button
            type="button"
            aria-label={`Dismiss alert for ${a.ip}`}
            onClick={() => dismiss(a.ip)}
            className="shrink-0 rounded p-1 text-white/90 hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );
}
