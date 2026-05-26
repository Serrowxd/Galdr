CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stave_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"author_label" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_staves" (
	"user_id" uuid NOT NULL,
	"stave_id" text NOT NULL,
	CONSTRAINT "saved_staves_user_id_stave_id_pk" PRIMARY KEY("user_id","stave_id")
);
--> statement-breakpoint
CREATE TABLE "stave_votes" (
	"user_id" uuid NOT NULL,
	"stave_id" text NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "stave_votes_user_id_stave_id_pk" PRIMARY KEY("user_id","stave_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX "comments_stave_id_idx" ON "comments" USING btree ("stave_id");--> statement-breakpoint
CREATE INDEX "saved_staves_user_idx" ON "saved_staves" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stave_votes_stave_id_idx" ON "stave_votes" USING btree ("stave_id");