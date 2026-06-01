export type Severity = "high" | "medium" | "low";

export interface LogEntry {
  timestamp: string;
  ip: string;
  method: string;
  url: string;
  status: number;
  bytes: number;
  userAgent: string;
  flagged: boolean;
}

export interface TimelineEvent {
  time: string;
  event: string;
  severity: Severity;
}

export interface Anomaly {
  ip: string;
  reason: string;
  confidence: number;
  relatedEntries: LogEntry[];
}

export interface AnalysisResult {
  summary: string;
  timeline: TimelineEvent[];
  anomalies: Anomaly[];
  stats: {
    total: number;
    uniqueIPs: number;
    timeRange: string;
    statusBreakdown: Record<string, number>;
  };
  entries: LogEntry[];
}

export interface PlaybookStep {
  step: number;
  action: string;
  priority: "immediate" | "short-term" | "long-term";
}

export interface Playbook {
  ip: string;
  attackType: string;
  steps: PlaybookStep[];
}

/**
 * The deterministic stats payload produced by the parser (Layer 1) and handed
 * to Claude (Layer 2). This is what gets sent to the model instead of raw logs.
 */
export interface ParsedLogs {
  entries: LogEntry[];
  stats: {
    total: number;
    uniqueIPs: number;
    timeRange: string;
    statusBreakdown: Record<string, number>;
    requestsPerIP: Record<string, number>;
    requestsPerMinute: Record<string, number>;
    /** Count of 401 (failed-auth) responses per source IP. */
    authFailuresPerIP: Record<string, number>;
    /** IPs that tripped the brute-force heuristic (repeated 401s in a short window). */
    bruteForceIPs: string[];
    detectedFormat: string;
  };
}
