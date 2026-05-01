import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export type GaldrDb = DrizzleDb;

let cached: DrizzleDb | undefined;

export function getDbOptional(): DrizzleDb | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cached) {
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}

export function getDb(): DrizzleDb {
  const db = getDbOptional();
  if (!db) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local for Drizzle / Neon.",
    );
  }
  return db;
}
