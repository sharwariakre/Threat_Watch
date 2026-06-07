import type { AnalysisResult, LogEntry } from "@/types/analysis";

/**
 * Mock analysis result so the dashboard components render with realistic data
 * before the API/DB are wired up.
 */
const sampleEntries: LogEntry[] = [
  { timestamp: "2024-03-12T08:01:14Z", ip: "203.0.113.45", method: "GET", url: "/login", status: 200, bytes: 1832, userAgent: "Mozilla/5.0", flagged: false },
  { timestamp: "2024-03-12T08:01:15Z", ip: "198.51.100.23", method: "POST", url: "/login", status: 401, bytes: 412, userAgent: "curl/8.1.2", flagged: true },
  { timestamp: "2024-03-12T08:01:16Z", ip: "198.51.100.23", method: "POST", url: "/login", status: 401, bytes: 412, userAgent: "curl/8.1.2", flagged: true },
  { timestamp: "2024-03-12T08:01:17Z", ip: "198.51.100.23", method: "POST", url: "/login", status: 401, bytes: 412, userAgent: "curl/8.1.2", flagged: true },
  { timestamp: "2024-03-12T08:02:03Z", ip: "192.0.2.77", method: "GET", url: "/admin/../../etc/passwd", status: 403, bytes: 0, userAgent: "sqlmap/1.7", flagged: true },
  { timestamp: "2024-03-12T08:03:21Z", ip: "203.0.113.45", method: "GET", url: "/dashboard", status: 200, bytes: 9821, userAgent: "Mozilla/5.0", flagged: false },
  { timestamp: "2024-03-12T08:04:55Z", ip: "192.0.2.77", method: "GET", url: "/api/users", status: 500, bytes: 0, userAgent: "sqlmap/1.7", flagged: true },
  { timestamp: "2024-03-12T08:05:10Z", ip: "203.0.113.99", method: "GET", url: "/images/logo.png", status: 200, bytes: 24112, userAgent: "Mozilla/5.0", flagged: false },
];

export const mockAnalysis: AnalysisResult = {
  summary:
    "Traffic over this window is dominated by a credential-stuffing attempt against /login from 198.51.100.23, which issued dozens of rapid POST requests using a curl user agent and received only 401 responses. Separately, 192.0.2.77 probed for a directory-traversal payload (/admin/../../etc/passwd) with a sqlmap user agent and triggered a 500 error on /api/users, suggesting active vulnerability scanning. Recommend blocking both source IPs at the WAF and reviewing the 500 on /api/users for potential exploitation.",
  timeline: [
    { time: "2024-03-12T08:01:15Z", event: "Burst of failed logins (401) from 198.51.100.23", severity: "high" },
    { time: "2024-03-12T08:02:03Z", event: "Directory traversal attempt /admin/../../etc/passwd from 192.0.2.77", severity: "high" },
    { time: "2024-03-12T08:04:55Z", event: "500 error on /api/users from scanner 192.0.2.77", severity: "medium" },
    { time: "2024-03-12T08:05:10Z", event: "Normal asset traffic resumes", severity: "low" },
  ],
  anomalies: [
    {
      ip: "198.51.100.23",
      reason: "Credential stuffing: 24 rapid POST /login requests, all 401, curl user agent.",
      confidence: 0.92,
      relatedEntries: sampleEntries.filter((e) => e.ip === "198.51.100.23"),
    },
    {
      ip: "192.0.2.77",
      reason: "Vulnerability scanning: directory traversal payload + sqlmap user agent, caused a 500.",
      confidence: 0.87,
      relatedEntries: sampleEntries.filter((e) => e.ip === "192.0.2.77"),
    },
  ],
  stats: {
    total: 8,
    uniqueIPs: 4,
    timeRange: "2024-03-12T08:01:14Z – 2024-03-12T08:05:10Z",
    statusBreakdown: { "200": 3, "401": 3, "403": 1, "500": 1 },
  },
  entries: sampleEntries,
  breachDetected: false,
};
