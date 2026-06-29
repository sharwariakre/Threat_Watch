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
  /** True when this brute-force IP also achieved a successful login (breach). */
  breached?: boolean;
  /** Full ISO timestamp of the successful 200 (only set when breached). */
  breachTime?: string;
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
  /** True when a confirmed brute-force IP also achieved a successful login (breach). */
  breachDetected: boolean;
  /** The IP that breached (only set when breachDetected). */
  breachIp?: string;
  /** Full ISO timestamp of the successful 200 (only set when breachDetected). */
  breachTime?: string;
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
 * A retrievable text passage derived from an AnalysisResult, used for semantic
 * (Tier 2) search. `type`/`ip` are kept for citation + UI focus.
 */
export interface RagChunk {
  id: string;
  type: "summary" | "anomaly" | "timeline" | "stats";
  ip?: string;
  text: string;
}

/** Structured filter extracted from a natural-language question (Tier 1). */
export interface LogQuery {
  ip?: string;
  statuses?: number[];
  methods?: string[];
  urlContains?: string;
  flaggedOnly?: boolean;
  breachedOnly?: boolean;
  /** True when the question also has a conceptual part needing semantic search. */
  isConceptual: boolean;
  /** True when no structured signal was found at all. */
  isEmpty: boolean;
}

export interface AskRequest {
  result_id: string;
  question: string;
}

export interface AskResponse {
  answer: string;
  mode: "structured" | "semantic" | "hybrid";
  /** IPs/sources the answer drew on, for UI citation + focus. */
  sources: { type: RagChunk["type"]; ip?: string; text: string }[];
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
