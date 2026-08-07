import { Pool } from "pg";

// Single pooled connection, reused across requests in the same server
// process - this is what makes repeat lookups fast (no per-request
// connect/teardown cost). See docs/DECISIONS.md for the indexing strategy
// that keeps individual queries themselves fast.
//
// Two connection modes:
//   - DATABASE_URL set (Supabase/Vercel convention): connection string +
//     SSL, small pool size - each serverless function instance gets its
//     own pool, so `max` here multiplies across concurrent instances.
//     Point this at Supabase's connection *pooler* (port 6543,
//     "Transaction" mode), not the direct DB port - a serverless
//     deployment can spin up far more concurrent instances than a fixed
//     Postgres connection limit tolerates otherwise.
//   - Otherwise: discrete CI_DB_* vars, no SSL - local dev default.
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    pool = connectionString
      ? new Pool({
          connectionString,
          ssl: { rejectUnauthorized: false },
          max: Number(process.env.CI_DB_POOL_MAX ?? 3),
        })
      : new Pool({
          host: process.env.CI_DB_HOST ?? "localhost",
          port: Number(process.env.CI_DB_PORT ?? 5432),
          database: process.env.CI_DB_NAME ?? "counter_intelligence",
          user: process.env.CI_DB_USER ?? "ci_app",
          password: process.env.CI_DB_PASSWORD ?? "ci_local_dev",
          max: Number(process.env.CI_DB_POOL_MAX ?? 5),
        });
  }
  return pool;
}
