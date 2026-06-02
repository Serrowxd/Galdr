/**
 * Seed the six cold-start threads for the Tavern.
 * Run: npm run seed:tavern-cold-start
 *
 * Requires DATABASE_URL in environment (from .env.local or shell).
 * Set SERROW_USER_ID in the environment, or replace the placeholder below.
 *
 * Idempotent: skips any thread whose slug already exists.
 */

// dotenv/config reads .env by default; also manually load .env.local for Next.js projects
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config(); // fallback to .env

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";

// We import the schema types directly so we don't pull in Next.js server-only
// modules that db/index.ts would indirectly reference.
import { threads } from "../db/schema";

const SERROW_USER_ID =
  process.env.SERROW_USER_ID ?? "REPLACE_WITH_SERROW_USER_UUID";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "ERROR: DATABASE_URL is not set. Add it to .env.local or export it before running this script.",
  );
  process.exit(1);
}

const client = postgres(DATABASE_URL, { prepare: false, max: 1 });
const db = drizzle(client);

type SeedThread = {
  category: "tutorial" | "pattern" | "question" | "showcase" | "meta";
  slug: string;
  title: string;
  isPinned: boolean;
  opBody: string;
};

// Short starter bodies so the threads surface on /tavern immediately (the index
// hides empty threads by default). Serrow can edit these in place after launch.
const SEED_THREADS: SeedThread[] = [
  {
    category: "meta",
    slug: "welcome-to-the-tavern",
    title: "Welcome to the Tavern — what this place is for",
    isPinned: true,
    opBody:
      "The Tavern is where staves get discussed, questioned, and built on. Every published stave gets a thread automatically — this is the commons around them.\n\nStart a thread for a question, a pattern you've found, a thing you made, or a note about Galdr itself. Be useful, be kind, link your sources.",
  },
  {
    category: "meta",
    slug: "tavern-rules",
    title: "Tavern rules + how moderation works",
    isPinned: true,
    opBody:
      "A few ground rules:\n\n- **Stay on-craft.** Threads are about staves, prompts, agents, and the work around them.\n- **No spam, no drive-by self-promo.** Showcase is fine; flooding isn't.\n- **Cite when you borrow.** Fork attribution is one click — use it.\n\nModeration is light-touch for now: flag a thread or comment and it lands in the queue.",
  },
  {
    category: "pattern",
    slug: "concept-extraction-heuristic",
    title: "When does an idea earn its own concept note?",
    isPinned: false,
    opBody:
      "A recurring question in building a second brain: when is something a passing mention vs. a thing that deserves its own note?\n\nMy heuristic: if I've referenced it from three different places, or I keep re-explaining it, it earns a note. What's yours?",
  },
  {
    category: "tutorial",
    slug: "agents-md-preamble-checklist",
    title: "Writing AGENTS.md preambles that survive subagent spawn",
    isPinned: false,
    opBody:
      "Preambles that work in the main loop often get dropped or garbled when a subagent spawns. A short checklist for writing ones that survive:\n\n1. Put hard constraints first, in imperative voice.\n2. Restate the non-obvious invariants — don't assume inheritance.\n3. Keep it under a screen; long preambles get truncated in context packets.",
  },
  {
    category: "showcase",
    slug: "sanctum-vault-philosophy",
    title: "The philosophy behind sanctum-vault (and why every part exists)",
    isPinned: false,
    opBody:
      "sanctum-vault is built on one idea: the log is the source of truth, everything else is a generated view. This thread walks through why each part of the structure exists and what it's load-bearing for.",
  },
  {
    category: "question",
    slug: "what-staves-do-you-run-daily",
    title: "What staves do you run every day?",
    isPinned: false,
    opBody:
      "Curious what's actually in everyone's daily rotation. Not the ones you starred and forgot — the ones you reach for every day. Drop yours below with a one-line why.",
  },
];

async function main() {
  console.log("Seeding Tavern cold-start threads…\n");

  if (SERROW_USER_ID === "REPLACE_WITH_SERROW_USER_UUID") {
    console.warn(
      "WARNING: Using placeholder SERROW_USER_ID. Set SERROW_USER_ID env var to your real UUID.",
    );
  }

  let inserted = 0;
  let skipped = 0;

  for (const seed of SEED_THREADS) {
    const existing = await db
      .select({ id: threads.id })
      .from(threads)
      .where(eq(threads.slug, seed.slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  SKIP  ${seed.slug}`);
      skipped++;
      continue;
    }

    await db.insert(threads).values({
      authorId: SERROW_USER_ID,
      slug: seed.slug,
      title: seed.title,
      opBody: seed.opBody,
      format: "discussion",
      category: seed.category,
      staveFamilyId: null,
      tags: [],
      isAutoCreated: false,
      isPinned: seed.isPinned,
      status: "open",
    });

    console.log(`  INSERT ${seed.slug}`);
    inserted++;
  }

  console.log(`\nDone. ${inserted} inserted, ${skipped} skipped.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
