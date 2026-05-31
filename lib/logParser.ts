import type { LogEntry, ParsedLogs } from "@/types/analysis";

/**
 * Layer 1 — deterministic log parser.
 *
 * No AI involved. Auto-detects the log format from the first few lines, then
 * regex-parses every line into a structured LogEntry and computes aggregate
 * stats. The output of this module is what gets sent to Claude (Layer 2).
 */

type LogFormat = "apache_combined" | "nginx" | "zscaler" | "unknown";

// Apache combined / Nginx default share the same shape:
// 127.0.0.1 - - [10/Oct/2023:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326 "ref" "agent"
const COMBINED_RE =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+[^"]*"\s+(\d{3})\s+(\d+|-)\s+"[^"]*"\s+"([^"]*)"/;

// ZScaler-style CSV-ish: timestamp,ip,method,url,status,bytes,useragent
// e.g. 2023-10-10T13:55:36Z,10.0.0.5,GET,/api/data,200,1234,"Mozilla/5.0 ..."
const ZSCALER_RE =
  /^([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*(\d{3}),\s*(\d+|-),\s*"?([^",]*)"?/;

function detectFormat(lines: string[]): LogFormat {
  const sample = lines.slice(0, 10);
  for (const line of sample) {
    if (!line.trim()) continue;
    if (COMBINED_RE.test(line)) return "apache_combined";
    if (ZSCALER_RE.test(line)) return "zscaler";
  }
  return "unknown";
}

/** Apache timestamp like 10/Oct/2023:13:55:36 -0700 -> ISO string. */
function parseApacheTimestamp(raw: string): string {
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const m = raw.match(
    /(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?/
  );
  if (!m) return raw;
  const [, day, mon, year, hh, mm, ss, tz] = m;
  const offset = tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : "Z";
  return `${year}-${months[mon] ?? "01"}-${day}T${hh}:${mm}:${ss}${offset}`;
}

function normalizeTimestamp(raw: string): string {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toISOString();
}

function parseLine(line: string, format: LogFormat): LogEntry | null {
  if (format === "apache_combined" || format === "nginx") {
    const m = line.match(COMBINED_RE);
    if (!m) return null;
    const [, ip, ts, method, url, status, bytes, userAgent] = m;
    return {
      timestamp: parseApacheTimestamp(ts),
      ip,
      method,
      url,
      status: parseInt(status, 10),
      bytes: bytes === "-" ? 0 : parseInt(bytes, 10),
      userAgent,
      flagged: false,
    };
  }
  if (format === "zscaler") {
    const m = line.match(ZSCALER_RE);
    if (!m) return null;
    const [, ts, ip, method, url, status, bytes, userAgent] = m;
    return {
      timestamp: normalizeTimestamp(ts),
      ip: ip.trim(),
      method: method.trim(),
      url: url.trim(),
      status: parseInt(status, 10),
      bytes: bytes === "-" ? 0 : parseInt(bytes, 10),
      userAgent: userAgent.trim(),
      flagged: false,
    };
  }
  return null;
}

/** Cheap deterministic heuristics so the UI shows something even before Claude. */
const SUSPICIOUS_URL_RE =
  /(\.\.\/|\/etc\/passwd|\/admin|union\s+select|<script|\/wp-admin|\.env|\/\.git|cmd=|exec\(|base64_decode)/i;

// Brute-force heuristics: repeated failed logins (HTTP 401) from one IP in a
// short window. Tuned low so a handful of rapid failures is enough to flag.
const BRUTE_FORCE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const BRUTE_FORCE_MIN_FAILURES = 5;

/**
 * Detect brute-force source IPs by sliding a 2-minute window over each IP's 401
 * responses. Returns the set of offending IPs and a per-IP 401 count.
 */
function detectBruteForce(entries: LogEntry[]): {
  bruteForceIPs: Set<string>;
  authFailuresPerIP: Record<string, number>;
} {
  const failuresByIP: Record<string, LogEntry[]> = {};
  const authFailuresPerIP: Record<string, number> = {};

  for (const e of entries) {
    if (e.status === 401) {
      (failuresByIP[e.ip] ??= []).push(e);
      authFailuresPerIP[e.ip] = (authFailuresPerIP[e.ip] ?? 0) + 1;
    }
  }

  const bruteForceIPs = new Set<string>();
  for (const [ip, fails] of Object.entries(failuresByIP)) {
    const times = fails
      .map((e) => new Date(e.timestamp).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);

    // Unparseable timestamps but many failures -> still suspicious.
    if (times.length === 0) {
      if (fails.length >= BRUTE_FORCE_MIN_FAILURES) bruteForceIPs.add(ip);
      continue;
    }

    let start = 0;
    for (let end = 0; end < times.length; end++) {
      while (times[end] - times[start] > BRUTE_FORCE_WINDOW_MS) start++;
      if (end - start + 1 >= BRUTE_FORCE_MIN_FAILURES) {
        bruteForceIPs.add(ip);
        break;
      }
    }
  }

  return { bruteForceIPs, authFailuresPerIP };
}

function flagEntries(
  entries: LogEntry[],
  requestsPerIP: Record<string, number>,
  bruteForceIPs: Set<string>
) {
  const RAPID_THRESHOLD = 20;
  for (const e of entries) {
    if (
      e.status >= 500 ||
      SUSPICIOUS_URL_RE.test(e.url) ||
      (requestsPerIP[e.ip] ?? 0) >= RAPID_THRESHOLD ||
      // brute-force: the failed-login attempts themselves
      (e.status === 401 && bruteForceIPs.has(e.ip))
    ) {
      e.flagged = true;
    }
  }
}

export function parseLogs(raw: string): ParsedLogs {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const format = detectFormat(lines);

  const entries: LogEntry[] = [];
  for (const line of lines) {
    const entry = parseLine(line, format);
    if (entry) entries.push(entry);
  }

  // --- aggregate stats ---
  const requestsPerIP: Record<string, number> = {};
  const statusBreakdown: Record<string, number> = {};
  const requestsPerMinute: Record<string, number> = {};
  const ips = new Set<string>();
  let minTime = Infinity;
  let maxTime = -Infinity;
  // Keep the original (offset-preserving) timestamp strings at the boundaries so
  // the UI can show the log's own wall-clock time, not a UTC-shifted one.
  let minTs = "";
  let maxTs = "";

  for (const e of entries) {
    ips.add(e.ip);
    requestsPerIP[e.ip] = (requestsPerIP[e.ip] ?? 0) + 1;

    const statusKey = String(e.status);
    statusBreakdown[statusKey] = (statusBreakdown[statusKey] ?? 0) + 1;

    const t = new Date(e.timestamp).getTime();
    if (!isNaN(t)) {
      if (t < minTime) {
        minTime = t;
        minTs = e.timestamp;
      }
      if (t > maxTime) {
        maxTime = t;
        maxTs = e.timestamp;
      }
      const minuteKey = new Date(t).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
      requestsPerMinute[minuteKey] = (requestsPerMinute[minuteKey] ?? 0) + 1;
    }
  }

  const { bruteForceIPs, authFailuresPerIP } = detectBruteForce(entries);
  flagEntries(entries, requestsPerIP, bruteForceIPs);

  const timeRange =
    isFinite(minTime) && isFinite(maxTime) ? `${minTs} – ${maxTs}` : "unknown";

  return {
    entries,
    stats: {
      total: entries.length,
      uniqueIPs: ips.size,
      timeRange,
      statusBreakdown,
      requestsPerIP,
      requestsPerMinute,
      authFailuresPerIP,
      bruteForceIPs: Array.from(bruteForceIPs),
      detectedFormat: format,
    },
  };
}
