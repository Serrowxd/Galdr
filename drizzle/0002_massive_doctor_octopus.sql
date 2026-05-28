CREATE TABLE "stave_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stave_id" uuid NOT NULL,
	"user_id" uuid,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stave_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stave_id" uuid NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "stave_files_stave_path_uniq" UNIQUE("stave_id","path"),
	CONSTRAINT "file_content_size" CHECK (octet_length("stave_files"."content") <= 1048576)
);
--> statement-breakpoint
CREATE TABLE "staves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"body" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"license" text DEFAULT 'CC BY 4.0' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"family_id" uuid NOT NULL,
	"predecessor_id" uuid,
	"forked_from" uuid,
	"release_notes" text,
	"views_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "staves_slug_unique" UNIQUE("slug"),
	CONSTRAINT "title_len" CHECK (char_length("staves"."title") <= 200),
	CONSTRAINT "description_len" CHECK ("staves"."description" IS NULL OR char_length("staves"."description") <= 2000),
	CONSTRAINT "body_size" CHECK (octet_length("staves"."body") <= 1048576),
	CONSTRAINT "tags_count" CHECK (array_length("staves"."tags", 1) IS NULL OR array_length("staves"."tags", 1) <= 10),
	CONSTRAINT "release_notes_len" CHECK ("staves"."release_notes" IS NULL OR char_length("staves"."release_notes") <= 500)
);
--> statement-breakpoint
DROP INDEX "stave_votes_stave_id_idx";--> statement-breakpoint
-- Engagement rows reference mock text slugs that cannot be cast to uuid, and the
-- new FKs require their stave_id to exist in the (empty) staves table. No real
-- content exists yet, so wipe these before the text->uuid migration.
TRUNCATE TABLE "comments", "stave_votes", "saved_staves";--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "stave_id" SET DATA TYPE uuid USING "stave_id"::uuid;--> statement-breakpoint
ALTER TABLE "saved_staves" ALTER COLUMN "stave_id" SET DATA TYPE uuid USING "stave_id"::uuid;--> statement-breakpoint
ALTER TABLE "stave_votes" ALTER COLUMN "stave_id" SET DATA TYPE uuid USING "stave_id"::uuid;--> statement-breakpoint
ALTER TABLE "stave_votes" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "stave_downloads" ADD CONSTRAINT "stave_downloads_stave_id_staves_id_fk" FOREIGN KEY ("stave_id") REFERENCES "public"."staves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stave_downloads" ADD CONSTRAINT "stave_downloads_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stave_files" ADD CONSTRAINT "stave_files_stave_id_staves_id_fk" FOREIGN KEY ("stave_id") REFERENCES "public"."staves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staves" ADD CONSTRAINT "staves_author_id_user_profiles_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staves" ADD CONSTRAINT "staves_predecessor_id_staves_id_fk" FOREIGN KEY ("predecessor_id") REFERENCES "public"."staves"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staves" ADD CONSTRAINT "staves_forked_from_staves_id_fk" FOREIGN KEY ("forked_from") REFERENCES "public"."staves"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stave_downloads_stave_downloaded_idx" ON "stave_downloads" USING btree ("stave_id","downloaded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stave_files_stave_id_idx" ON "stave_files" USING btree ("stave_id");--> statement-breakpoint
CREATE INDEX "staves_author_id_idx" ON "staves" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "staves_status_published_idx" ON "staves" USING btree ("status","published_at" DESC NULLS LAST) WHERE "staves"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "staves_family_version_idx" ON "staves" USING btree ("family_id","version" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "staves_forked_from_idx" ON "staves" USING btree ("forked_from") WHERE "staves"."forked_from" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_stave_id_staves_id_fk" FOREIGN KEY ("stave_id") REFERENCES "public"."staves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_staves" ADD CONSTRAINT "saved_staves_stave_id_staves_id_fk" FOREIGN KEY ("stave_id") REFERENCES "public"."staves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stave_votes" ADD CONSTRAINT "stave_votes_stave_id_staves_id_fk" FOREIGN KEY ("stave_id") REFERENCES "public"."staves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stave_votes_stave_id_idx" ON "stave_votes" USING btree ("stave_id","created_at" DESC NULLS LAST);