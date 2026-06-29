import type { LogQuery } from "@/types/analysis";

/**
 * Deterministic query router for the hybrid Q&A feature.
 *
 * Extracts *structured* signals (IP, status codes, HTTP methods, URL fragment,
 * flagged/breached intent) from a natural-language question using regex/keywords.
 * No LLM, no embeddings — exact-fact questions like "logs from 10.0.0.5" or
 * "show me the 401s" resolve here precisely, instead of being routed through
 * semantic search where near-duplicate IPs/status codes collide.
 *
 * `isConceptual` is set when the question also contains fuzzy intent that a
 * structured filter can't answer (e.g. "anything suspicious from 10.0.0.5?"),
 * which the route uses to decide structured vs semantic vs hybrid.
 */

const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
// Optional trailing "s" so "401s"/"500s" still match (the digit/letter junction
// has no \b, which would otherwise drop the pluralized form).
const STATUS_RE = /\b([1-5]\d{2})s?\b/g;
const METHOD_RE = /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/gi;
// A /path token, optionally quoted: "/login", /etc/passwd, '/admin'
const PATH_RE = /["']?(\/[\w./\-]+)["']?/;

// Words that imply a conceptual/analytical question rather than a pure lookup.
const CONCEPTUAL_HINTS = [
  "why", "explain", "summary", "summarize", "suspicious", "anomal",
  "attack", "threat", "reconnaissance", "recon", "scan", "traversal",
  "injection", "sqli", "xss", "malicious", "worst", "risk", "should",
  "recommend", "happened", "story", "overall", "credential", "stuffing",
];

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function routeQuestion(question: string): LogQuery {
  const q = question.toLowerCase();

  const ipMatch = question.match(IPV4_RE);
  const ip = ipMatch ? ipMatch[0] : undefined;

  // Status codes: explicit 3-digit codes plus common aliases.
  const explicitStatuses = (question.match(STATUS_RE) ?? []).map((s) =>
    parseInt(s, 10)
  );
  const aliasStatuses: number[] = [];
  if (/\b(failed login|failed logins|unauthor|invalid credential|brute)\b/.test(q))
    aliasStatuses.push(401);
  if (/\bforbidden\b/.test(q)) aliasStatuses.push(403);
  if (/\bnot found\b/.test(q)) aliasStatuses.push(404);
  if (/\b(server error|5xx|errors?)\b/.test(q))
    aliasStatuses.push(500, 502, 503);
  // Drop IP octets that the status regex may have picked up.
  const ipOctets = ip ? ip.split(".").map((n) => parseInt(n, 10)) : [];
  const statuses = uniq([...explicitStatuses, ...aliasStatuses]).filter(
    (s) => s >= 100 && s <= 599 && !(ip && ipOctets.includes(s))
  );

  const methods = uniq(
    (question.match(METHOD_RE) ?? []).map((m) => m.toUpperCase())
  );

  // Only treat a /path as a filter if it isn't just part of the question prose.
  const pathMatch = question.match(PATH_RE);
  const urlContains = pathMatch ? pathMatch[1] : undefined;

  const breachedOnly = /\b(breach|broke in|broken in|got in|gained access|successful brute)\b/.test(q);
  const flaggedOnly = /\b(flag|flagged|suspicious request)\b/.test(q);

  const hasStructured =
    Boolean(ip) ||
    statuses.length > 0 ||
    methods.length > 0 ||
    Boolean(urlContains) ||
    breachedOnly ||
    flaggedOnly;

  const isConceptual = CONCEPTUAL_HINTS.some((h) => q.includes(h));

  return {
    ip,
    statuses: statuses.length ? statuses : undefined,
    methods: methods.length ? methods : undefined,
    urlContains,
    flaggedOnly: flaggedOnly || undefined,
    breachedOnly: breachedOnly || undefined,
    isConceptual,
    isEmpty: !hasStructured,
  };
}
