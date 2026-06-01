/**
 * Shared attack-type classification, derived from an anomaly's reason text.
 * Used by both the AnomaliesPanel badges and the Top Attacking IPs panel so the
 * two stay consistent.
 */
export type AttackVariant = "red" | "orange" | "yellow" | "gray";

export interface AttackClass {
  label: string;
  variant: AttackVariant;
}

export function classifyAttack(reason: string): AttackClass {
  const r = reason.toLowerCase();

  if (r.includes("brute force") || r.includes("login attempts")) {
    return { label: "Brute Force", variant: "red" };
  }
  if (
    r.includes("sql injection") ||
    r.includes("union") ||
    r.includes("or-based")
  ) {
    return { label: "SQL Injection", variant: "orange" };
  }
  if (r.includes("traversal") || r.includes("etc/passwd")) {
    return { label: "Path Traversal", variant: "orange" };
  }
  if (
    r.includes("recon") ||
    r.includes("reconnaissance") ||
    r.includes("scanning") ||
    r.includes("enumeration")
  ) {
    return { label: "Recon", variant: "yellow" };
  }
  if (r.includes("credential") || r.includes("stuffing")) {
    return { label: "Credential Stuffing", variant: "red" };
  }
  return { label: "Anomaly", variant: "gray" };
}
