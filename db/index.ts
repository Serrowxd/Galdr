import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export type GaldrDb = DrizzleDb;

let cached: DrizzleDb | undefined;

export function getDbOptional(): DrizzleDb | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cached) {
    const client = postgres(url, { prepare: false });
    cached = drizzle(client, { schema });
  }
  return cached;
}

export function getDb(): DrizzleDb {
  const db = getDbOptional();
  if (!db) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  }
  return db;
}
