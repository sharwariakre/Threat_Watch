// Runtime check of the two-layer pipeline against the sample log.
// Writes results to /tmp/verify_result.json to avoid noisy terminal output.
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { parseLogs } from "../lib/logParser";
import { analyzeWithClaude } from "../lib/claudeAnalyzer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const raw = readFileSync(
    path.join(__dirname, "..", "sample-logs", "apache_sample.log"),
    "utf-8"
  );

  const parsed = parseLogs(raw);
  const result = await analyzeWithClaude(parsed);

  const out = {
    detectedFormat: parsed.stats.detectedFormat,
    total: parsed.stats.total,
    uniqueIPs: parsed.stats.uniqueIPs,
    requestsPerIP: parsed.stats.requestsPerIP,
    timeRange: parsed.stats.timeRange,
    bruteForceIPs: parsed.stats.bruteForceIPs,
    authFailuresPerIP: parsed.stats.authFailuresPerIP,
    anomalies: result.anomalies.map((a) => ({
      ip: a.ip,
      confidence: a.confidence,
      reason: a.reason,
      relatedCount: a.relatedEntries.length,
    })),
  };

  writeFileSync("/tmp/verify_result.json", JSON.stringify(out, null, 2));
}

main();
