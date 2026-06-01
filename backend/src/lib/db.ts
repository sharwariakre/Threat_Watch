import { Pool, type QueryResult, type QueryResultRow } from "pg";

/**
 * Single shared pg Pool. Stashed on globalThis so tsx watch reloads in dev don't
 * exhaust connections.
 */
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5433/log_anomaly",
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as never);
}
