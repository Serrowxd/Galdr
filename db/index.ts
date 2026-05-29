import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export type GaldrDb = DrizzleDb;

// Cache the client on globalThis so Next.js dev HMR reuses one pool across module
// reloads. Without this, every hot reload spins up a fresh postgres-js pool and
// leaks its connections until the database runs out of slots ("too many clients").
const globalForDb = globalThis as unknown as {
  __galdrDb?: DrizzleDb;
};

export function getDbOptional(): DrizzleDb | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!globalForDb.__galdrDb) {
    const client = postgres(url, {
      prepare: false,
      // Keep the footprint small against Supabase's direct-connection slot limit.
      max: 5,
      // Release idle connections so a quiet dev session doesn't hold slots open.
      idle_timeout: 20,
    });
    globalForDb.__galdrDb = drizzle(client, { schema });
  }
  return globalForDb.__galdrDb;
}

export function getDb(): DrizzleDb {
  const db = getDbOptional();
  if (!db) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  }
  return db;
}
