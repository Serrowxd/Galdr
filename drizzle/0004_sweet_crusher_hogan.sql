CREATE TABLE "grimoire_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grimoire_id" uuid NOT NULL,
	"user_id" uuid,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grimoire_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grimoire_id" uuid NOT NULL,
	"stave_family_id" uuid NOT NULL,
	"pinned_stave_id" uuid,
	"position" integer NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"annotation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "g_entry_position_unique" UNIQUE("grimoire_id","position"),
	CONSTRAINT "g_entry_annotation_len" CHECK ("grimoire_entries"."annotation" IS NULL OR char_length("grimoire_entries"."annotation") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "grimoire_inclusion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grimoire_id" uuid NOT NULL,
	"stave_family_id" uuid NOT NULL,
	"stave_author_id" uuid NOT NULL,
	"grimoire_author_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"grimoire_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "g_inclusion_event_type_check" CHECK ("grimoire_inclusion_events"."event_type" IN ('included', 'removed'))
);
--> statement-breakpoint
CREATE TABLE "grimoire_votes" (
	"user_id" uuid NOT NULL,
	"grimoire_id" uuid NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grimoire_votes_user_id_grimoire_id_pk" PRIMARY KEY("user_id","grimoire_id"),
	CONSTRAINT "g_vote_value_check" CHECK ("grimoire_votes"."value" IN (1, -1))
);
--> statement-breakpoint
CREATE TABLE "grimoires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"short_description" text,
	"details" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"license" text DEFAULT 'CC BY 4.0' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"family_id" uuid NOT NULL,
	"predecessor_id" uuid,
	"forked_from" uuid,
	"release_notes" text,
	"views_count" integer DEFAULT 0 NOT NULL,
	"downloads_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "grimoires_slug_unique" UNIQUE("slug"),
	CONSTRAINT "g_title_len" CHECK (char_length("grimoires"."title") <= 200),
	CONSTRAINT "g_short_desc_len" CHECK ("grimoires"."short_description" IS NULL OR char_length("grimoires"."short_description") <= 500),
	CONSTRAINT "g_details_len" CHECK ("grimoires"."details" IS NULL OR char_length("grimoires"."details") <= 20000),
	CONSTRAINT "g_tags_count" CHECK (array_length("grimoires"."tags", 1) IS NULL OR array_length("grimoires"."tags", 1) <= 10),
	CONSTRAINT "g_release_notes_len" CHECK ("grimoires"."release_notes" IS NULL OR char_length("grimoires"."release_notes") <= 500)
);
--> statement-breakpoint
CREATE TABLE "saved_grimoires" (
	"user_id" uuid NOT NULL,
	"grimoire_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_grimoires_user_id_grimoire_id_pk" PRIMARY KEY("user_id","grimoire_id")
);
--> statement-breakpoint
ALTER TABLE "grimoire_downloads" ADD CONSTRAINT "grimoire_downloads_grimoire_id_grimoires_id_fk" FOREIGN KEY ("grimoire_id") REFERENCES "public"."grimoires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grimoire_downloads" ADD CONSTRAINT "grimoire_downloads_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grimoire_entries" ADD CONSTRAINT "grimoire_entries_grimoire_id_grimoires_id_fk" FOREIGN KEY ("grimoire_id") REFERENCES "public"."grimoires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grimoire_entries" ADD CONSTRAINT "grimoire_entries_pinned_stave_id_staves_id_fk" FOREIGN KEY ("pinned_stave_id") REFERENCES "public"."staves"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grimoire_inclusion_events" ADD CONSTRAINT "grimoire_inclusion_events_grimoire_id_grimoires_id_fk" FOREIGN KEY ("grimoire_id") REFERENCES "public"."grimoires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grimoire_inclusion_events" ADD CONSTRAINT "grimoire_inclusion_events_stave_author_id_user_profiles_user_id_fk" FOREIGN KEY ("stave_author_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grimoire_inclusion_events" ADD CONSTRAINT "grimoire_inclusion_events_grimoire_author_id_user_profiles_user_id_fk" FOREIGN KEY ("grimoire_author_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grimoire_votes" ADD CONSTRAINT "grimoire_votes_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grimoire_votes" ADD CONSTRAINT "grimoire_votes_grimoire_id_grimoires_id_fk" FOREIGN KEY ("grimoire_id") REFERENCES "public"."grimoires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grimoires" ADD CONSTRAINT "grimoires_author_id_user_profiles_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grimoires" ADD CONSTRAINT "grimoires_predecessor_id_grimoires_id_fk" FOREIGN KEY ("predecessor_id") REFERENCES "public"."grimoires"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grimoires" ADD CONSTRAINT "grimoires_forked_from_grimoires_id_fk" FOREIGN KEY ("forked_from") REFERENCES "public"."grimoires"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_grimoires" ADD CONSTRAINT "saved_grimoires_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_grimoires" ADD CONSTRAINT "saved_grimoires_grimoire_id_grimoires_id_fk" FOREIGN KEY ("grimoire_id") REFERENCES "public"."grimoires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grimoire_downloads_grimoire_downloaded_idx" ON "grimoire_downloads" USING btree ("grimoire_id","downloaded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "grimoire_entries_grimoire_position_idx" ON "grimoire_entries" USING btree ("grimoire_id","position");--> statement-breakpoint
CREATE INDEX "grimoire_entries_stave_family_idx" ON "grimoire_entries" USING btree ("stave_family_id");--> statement-breakpoint
CREATE INDEX "grimoire_entries_pinned_stave_idx" ON "grimoire_entries" USING btree ("pinned_stave_id") WHERE "grimoire_entries"."pinned_stave_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "grimoire_inclusion_events_stave_author_idx" ON "grimoire_inclusion_events" USING btree ("stave_author_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "grimoire_inclusion_events_grimoire_idx" ON "grimoire_inclusion_events" USING btree ("grimoire_id");--> statement-breakpoint
CREATE INDEX "grimoire_votes_grimoire_idx" ON "grimoire_votes" USING btree ("grimoire_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "grimoires_author_id_idx" ON "grimoires" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "grimoires_status_published_idx" ON "grimoires" USING btree ("status","published_at" DESC NULLS LAST) WHERE "grimoires"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "grimoires_family_version_idx" ON "grimoires" USING btree ("family_id","version" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "grimoires_forked_from_idx" ON "grimoires" USING btree ("forked_from") WHERE "grimoires"."forked_from" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "saved_grimoires_user_idx" ON "saved_grimoires" USING btree ("user_id");