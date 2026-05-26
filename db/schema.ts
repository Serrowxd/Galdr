import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Stores usernames chosen during onboarding, keyed by Supabase auth user UUID. */
export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id").primaryKey(),
  username: text("username").notNull().unique(),
  bio: text("bio"),
  // Public avatar URL, mirrored here (canonical for display) so any visitor can
  // render a scribe's picture without reading another user's auth metadata.
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staveId: text("stave_id").notNull(),
    userId: uuid("user_id").notNull(),
    authorLabel: text("author_label").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    staveIdx: index("comments_stave_id_idx").on(t.staveId),
  }),
);

export const staveVotes = pgTable(
  "stave_votes",
  {
    userId: uuid("user_id").notNull(),
    staveId: text("stave_id").notNull(),
    value: integer("value").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.staveId] }),
    staveIdx: index("stave_votes_stave_id_idx").on(t.staveId),
  }),
);

export const savedStaves = pgTable(
  "saved_staves",
  {
    userId: uuid("user_id").notNull(),
    staveId: text("stave_id").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.staveId] }),
    userIdx: index("saved_staves_user_idx").on(t.userId),
  }),
);
