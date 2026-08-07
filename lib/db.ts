import { Pool } from "pg";

// Single pooled connection, reused across requests in the same server
// process - this is what makes repeat lookups fast (no per-request
// connect/teardown cost). See docs/DECISIONS.md for the indexing strategy
// that keeps individual queries themselves fast.
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.CI_DB_HOST ?? "localhost",
      port: Number(process.env.CI_DB_PORT ?? 5432),
      database: process.env.CI_DB_NAME ?? "counter_intelligence",
      user: process.env.CI_DB_USER ?? "ci_app",
      password: process.env.CI_DB_PASSWORD ?? "ci_local_dev",
      max: 5,
    });
  }
  return pool;
}
