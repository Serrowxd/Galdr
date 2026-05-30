import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
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
    // Path of the package file that mirrors `body` (the canonical stave text).
    // Null for legacy rows — resolved heuristically from body content on load.
    entrypointPath: text("entrypoint_path"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),

    status: text("status").notNull().default("draft"),
    license: text("license").notNull().default("CC BY 4.0"),
    // Unlisted + owner-only when true: published but hidden from registry,
    // saga, and search; only the author can open its page. See spec 06.
    private: boolean("private").notNull().default(false),

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

export const grimoires = pgTable(
  "grimoires",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),

    title: text("title").notNull(),
    shortDescription: text("short_description"),
    details: text("details"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),

    status: text("status").notNull().default("draft"),
    license: text("license").notNull().default("CC BY 4.0"),
    // ORCHESTRATION mode is signaled via the reserved tag value 'orchestration'
    // in `tags` (spec 07 decision #5) — no dedicated column.

    // Version chain — semantics identical to staves; see spec 03.
    version: integer("version").notNull().default(1),
    familyId: uuid("family_id").notNull(),
    predecessorId: uuid("predecessor_id").references(
      (): AnyPgColumn => grimoires.id,
      { onDelete: "set null" },
    ),
    forkedFrom: uuid("forked_from").references((): AnyPgColumn => grimoires.id, {
      onDelete: "set null",
    }),
    releaseNotes: text("release_notes"),

    viewsCount: integer("views_count").notNull().default(0),
    // Denormalized convenience for card display; source of truth is grimoire_downloads.
    downloadsCount: integer("downloads_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    titleLen: check("g_title_len", sql`char_length(${t.title}) <= 200`),
    shortDescLen: check(
      "g_short_desc_len",
      sql`${t.shortDescription} IS NULL OR char_length(${t.shortDescription}) <= 500`,
    ),
    detailsLen: check(
      "g_details_len",
      sql`${t.details} IS NULL OR char_length(${t.details}) <= 20000`,
    ),
    tagsCount: check(
      "g_tags_count",
      sql`array_length(${t.tags}, 1) IS NULL OR array_length(${t.tags}, 1) <= 10`,
    ),
    releaseNotesLen: check(
      "g_release_notes_len",
      sql`${t.releaseNotes} IS NULL OR char_length(${t.releaseNotes}) <= 500`,
    ),
    authorIdx: index("grimoires_author_id_idx").on(t.authorId),
    publishedIdx: index("grimoires_status_published_idx")
      .on(t.status, t.publishedAt.desc())
      .where(sql`${t.deletedAt} IS NULL`),
    familyIdx: index("grimoires_family_version_idx").on(t.familyId, t.version.desc()),
    forkedIdx: index("grimoires_forked_from_idx")
      .on(t.forkedFrom)
      .where(sql`${t.forkedFrom} IS NOT NULL`),
  }),
);

export const grimoireEntries = pgTable(
  "grimoire_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grimoireId: uuid("grimoire_id")
      .notNull()
      .references(() => grimoires.id, { onDelete: "cascade" }),

    // Logical pointer to a stave FAMILY (not a single row). family_id is not unique
    // on staves, so this can't be a real FK — validated at the API layer.
    staveFamilyId: uuid("stave_family_id").notNull(),

    // When set, freezes the entry to a specific stave row (its family_id must equal
    // staveFamilyId — API-layer check). When null, resolver returns latest published.
    pinnedStaveId: uuid("pinned_stave_id").references(() => staves.id, {
      onDelete: "set null",
    }),

    position: integer("position").notNull(),
    isOptional: boolean("is_optional").notNull().default(false),
    annotation: text("annotation"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniquePosition: unique("g_entry_position_unique").on(t.grimoireId, t.position),
    annotationLen: check(
      "g_entry_annotation_len",
      sql`${t.annotation} IS NULL OR char_length(${t.annotation}) <= 1000`,
    ),
    grimoireIdx: index("grimoire_entries_grimoire_position_idx").on(
      t.grimoireId,
      t.position,
    ),
    familyIdx: index("grimoire_entries_stave_family_idx").on(t.staveFamilyId),
    pinnedIdx: index("grimoire_entries_pinned_stave_idx")
      .on(t.pinnedStaveId)
      .where(sql`${t.pinnedStaveId} IS NOT NULL`),
  }),
);

export const grimoireVotes = pgTable(
  "grimoire_votes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    grimoireId: uuid("grimoire_id")
      .notNull()
      .references(() => grimoires.id, { onDelete: "cascade" }),
    value: smallint("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.grimoireId] }),
    valueCheck: check("g_vote_value_check", sql`${t.value} IN (1, -1)`),
    grimoireIdx: index("grimoire_votes_grimoire_idx").on(
      t.grimoireId,
      t.createdAt.desc(),
    ),
  }),
);

export const savedGrimoires = pgTable(
  "saved_grimoires",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    grimoireId: uuid("grimoire_id")
      .notNull()
      .references(() => grimoires.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.grimoireId] }),
    userIdx: index("saved_grimoires_user_idx").on(t.userId),
  }),
);

export const grimoireDownloads = pgTable(
  "grimoire_downloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grimoireId: uuid("grimoire_id")
      .notNull()
      .references(() => grimoires.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => userProfiles.userId, {
      onDelete: "set null",
    }),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    grimoireIdx: index("grimoire_downloads_grimoire_downloaded_idx").on(
      t.grimoireId,
      t.downloadedAt.desc(),
    ),
  }),
);

// Audit log of when a stave is included in / removed from a PUBLISHED grimoire.
// Writes-only in v1 — no UI surface. Future notifications/inbox reads from here.
export const grimoireInclusionEvents = pgTable(
  "grimoire_inclusion_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grimoireId: uuid("grimoire_id")
      .notNull()
      .references(() => grimoires.id, { onDelete: "cascade" }),
    staveFamilyId: uuid("stave_family_id").notNull(),
    staveAuthorId: uuid("stave_author_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    grimoireAuthorId: uuid("grimoire_author_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    grimoireVersion: integer("grimoire_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    eventTypeCheck: check(
      "g_inclusion_event_type_check",
      sql`${t.eventType} IN ('included', 'removed')`,
    ),
    staveAuthorIdx: index("grimoire_inclusion_events_stave_author_idx").on(
      t.staveAuthorId,
      t.createdAt.desc(),
    ),
    grimoireIdx: index("grimoire_inclusion_events_grimoire_idx").on(t.grimoireId),
  }),
);

export type Stave = typeof staves.$inferSelect;
export type NewStave = typeof staves.$inferInsert;
export type StaveFile = typeof staveFiles.$inferSelect;
export type Grimoire = typeof grimoires.$inferSelect;
export type NewGrimoire = typeof grimoires.$inferInsert;
export type GrimoireEntry = typeof grimoireEntries.$inferSelect;
export type NewGrimoireEntry = typeof grimoireEntries.$inferInsert;
export type GrimoireVote = typeof grimoireVotes.$inferSelect;
export type SavedGrimoire = typeof savedGrimoires.$inferSelect;
export type GrimoireDownload = typeof grimoireDownloads.$inferSelect;
export type GrimoireInclusionEvent = typeof grimoireInclusionEvents.$inferSelect;
