import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { DDL } from "./ddl";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const g = globalThis as unknown as { __sbdDb?: Promise<DB> };

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Production / test site: a hosted Postgres database.
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: 5 });
    await pool.query(DDL);
    return drizzle(pool, { schema }) as unknown as DB;
  }
  // No DATABASE_URL: a small local database in the .data folder, for development and tests only.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(process.env.PGLITE_DIR ?? "memory://");
  await client.exec(DDL);
  return drizzle(client, { schema }) as unknown as DB;
}

export function db(): Promise<DB> {
  if (!g.__sbdDb) g.__sbdDb = connect();
  return g.__sbdDb;
}

export { schema };
