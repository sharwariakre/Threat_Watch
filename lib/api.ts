/**
 * Base URL of the standalone Express backend. Configurable via NEXT_PUBLIC_API_URL
 * so the frontend can point at a different host/port without code changes.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Build a full backend URL: apiUrl("/api/auth/login"). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
