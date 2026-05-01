import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staveId: text("stave_id").notNull(),
    clerkUserId: text("clerk_user_id").notNull(),
    authorLabel: text("author_label").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    staveIdx: index("comments_stave_id_idx").on(t.staveId),
  }),
);

export const staveVotes = pgTable(
  "stave_votes",
  {
    clerkUserId: text("clerk_user_id").notNull(),
    staveId: text("stave_id").notNull(),
    value: integer("value").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.clerkUserId, t.staveId] }),
    staveIdx: index("stave_votes_stave_id_idx").on(t.staveId),
  }),
);

export const savedStaves = pgTable(
  "saved_staves",
  {
    clerkUserId: text("clerk_user_id").notNull(),
    staveId: text("stave_id").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.clerkUserId, t.staveId] }),
    userIdx: index("saved_staves_user_idx").on(t.clerkUserId),
  }),
);
