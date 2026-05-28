import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
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

export const staves = pgTable(
  "staves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description"),
    body: text("body").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),

    status: text("status").notNull().default("draft"),
    license: text("license").notNull().default("CC BY 4.0"),

    // Version chain — semantics in spec 03.
    version: integer("version").notNull().default(1),
    familyId: uuid("family_id").notNull(),
    predecessorId: uuid("predecessor_id").references(
      (): AnyPgColumn => staves.id,
      { onDelete: "set null" },
    ),
    forkedFrom: uuid("forked_from").references((): AnyPgColumn => staves.id, {
      onDelete: "set null",
    }),
    releaseNotes: text("release_notes"),

    viewsCount: integer("views_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    titleLen: check("title_len", sql`char_length(${t.title}) <= 200`),
    descLen: check(
      "description_len",
      sql`${t.description} IS NULL OR char_length(${t.description}) <= 2000`,
    ),
    bodySize: check("body_size", sql`octet_length(${t.body}) <= 1048576`),
    tagsCount: check(
      "tags_count",
      sql`array_length(${t.tags}, 1) IS NULL OR array_length(${t.tags}, 1) <= 10`,
    ),
    releaseNotesLen: check(
      "release_notes_len",
      sql`${t.releaseNotes} IS NULL OR char_length(${t.releaseNotes}) <= 500`,
    ),
    authorIdx: index("staves_author_id_idx").on(t.authorId),
    publishedIdx: index("staves_status_published_idx")
      .on(t.status, t.publishedAt.desc())
      .where(sql`${t.deletedAt} IS NULL`),
    familyIdx: index("staves_family_version_idx").on(t.familyId, t.version.desc()),
    forkedIdx: index("staves_forked_from_idx")
      .on(t.forkedFrom)
      .where(sql`${t.forkedFrom} IS NOT NULL`),
  }),
);

export const staveFiles = pgTable(
  "stave_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staveId: uuid("stave_id")
      .notNull()
      .references(() => staves.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
  },
  (t) => ({
    uniquePath: unique("stave_files_stave_path_uniq").on(t.staveId, t.path),
    contentSize: check(
      "file_content_size",
      sql`octet_length(${t.content}) <= 1048576`,
    ),
    staveIdx: index("stave_files_stave_id_idx").on(t.staveId),
  }),
);

export const staveDownloads = pgTable(
  "stave_downloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staveId: uuid("stave_id")
      .notNull()
      .references(() => staves.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => userProfiles.userId, {
      onDelete: "set null",
    }),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    staveDownloadedIdx: index("stave_downloads_stave_downloaded_idx").on(
      t.staveId,
      t.downloadedAt.desc(),
    ),
  }),
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staveId: uuid("stave_id")
      .notNull()
      .references(() => staves.id, { onDelete: "cascade" }),
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
    staveId: uuid("stave_id")
      .notNull()
      .references(() => staves.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.staveId] }),
    staveIdx: index("stave_votes_stave_id_idx").on(t.staveId, t.createdAt.desc()),
  }),
);

export const savedStaves = pgTable(
  "saved_staves",
  {
    userId: uuid("user_id").notNull(),
    staveId: uuid("stave_id")
      .notNull()
      .references(() => staves.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.staveId] }),
    userIdx: index("saved_staves_user_idx").on(t.userId),
  }),
);

export type Stave = typeof staves.$inferSelect;
export type NewStave = typeof staves.$inferInsert;
export type StaveFile = typeof staveFiles.$inferSelect;
