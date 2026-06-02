-- 0006_tavern_schema.sql
-- Tavern: threads, comments, votes, saves, views, flags + enums + triggers + RLS

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE thread_category AS ENUM ('tutorial', 'pattern', 'question', 'showcase', 'meta');
CREATE TYPE thread_format   AS ENUM ('discussion', 'documentation');

-- ============================================================
-- HELPER: tags_are_valid_slugs (used in threads CHECK constraint)
-- Subqueries are not allowed in CHECK constraints, so we wrap the
-- array-element validation in an IMMUTABLE SQL function instead.
-- ============================================================

CREATE OR REPLACE FUNCTION tags_are_valid_slugs(tags text[])
  RETURNS boolean AS $$
  SELECT COALESCE(bool_and(elem ~ '^[a-z0-9][a-z0-9-]{0,23}$'), true)
  FROM unnest(tags) AS elem;
$$ LANGUAGE sql IMMUTABLE;

-- ============================================================
-- TABLE: threads
-- ============================================================

CREATE TABLE threads (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stave_family_id   uuid        REFERENCES staves(id),
  category          thread_category,
  format            thread_format   NOT NULL DEFAULT 'discussion',
  author_id         uuid        NOT NULL REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  title             text        NOT NULL,
  slug              text        NOT NULL UNIQUE,
  op_body           text        NOT NULL DEFAULT '',
  op_edited_at      timestamptz,
  tags              text[]      NOT NULL DEFAULT '{}'::text[],
  status            text        NOT NULL DEFAULT 'open',
  is_pinned         boolean     NOT NULL DEFAULT false,
  is_auto_created   boolean     NOT NULL DEFAULT false,
  vote_score        integer     NOT NULL DEFAULT 0,
  monthly_score     integer     NOT NULL DEFAULT 0,
  comments_count    integer     NOT NULL DEFAULT 0,
  views_count       integer     NOT NULL DEFAULT 0,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_activity_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT threads_status_check
    CHECK (status IN ('open', 'locked', 'archived')),

  CONSTRAINT threads_tags_count_check
    CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 8),

  CONSTRAINT threads_tags_shape_check
    CHECK (tags_are_valid_slugs(tags)),

  CONSTRAINT threads_op_body_size_check
    CHECK (octet_length(op_body) <= 65536)
);

-- DEFERRABLE unique constraint (must be raw SQL — Drizzle can't express DEFERRABLE)
ALTER TABLE threads
  ADD CONSTRAINT threads_one_per_stave_family
  UNIQUE (stave_family_id) DEFERRABLE INITIALLY DEFERRED;

-- Indexes on threads
CREATE INDEX threads_stave_family_id_idx
  ON threads (stave_family_id)
  WHERE deleted_at IS NULL;

CREATE INDEX threads_category_idx
  ON threads (category)
  WHERE deleted_at IS NULL;

CREATE INDEX threads_last_activity_idx
  ON threads (last_activity_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX threads_monthly_score_idx
  ON threads (monthly_score DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX threads_tags_gin_idx
  ON threads USING GIN (tags)
  WHERE deleted_at IS NULL;

-- ============================================================
-- TABLE: thread_comments
-- ============================================================

CREATE TABLE thread_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid        NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author_id   uuid        NOT NULL REFERENCES user_profiles(user_id) ON DELETE RESTRICT,
  reply_to    uuid        REFERENCES thread_comments(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  edited_at   timestamptz,
  vote_score  integer     NOT NULL DEFAULT 0,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT thread_comments_body_size_check
    CHECK (octet_length(body) <= 16384)
);

CREATE INDEX thread_comments_thread_created_idx
  ON thread_comments (thread_id, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX thread_comments_reply_to_idx
  ON thread_comments (reply_to)
  WHERE deleted_at IS NULL;

-- ============================================================
-- TABLE: thread_votes
-- ============================================================

CREATE TABLE thread_votes (
  user_id     uuid      NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  thread_id   uuid      NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  value       smallint  NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, thread_id),
  CONSTRAINT thread_votes_value_check CHECK (value IN (-1, 1))
);

CREATE INDEX thread_votes_thread_id_idx    ON thread_votes (thread_id);
CREATE INDEX thread_votes_created_at_idx   ON thread_votes (created_at DESC);

-- ============================================================
-- TABLE: comment_votes
-- ============================================================

CREATE TABLE comment_votes (
  user_id     uuid      NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  comment_id  uuid      NOT NULL REFERENCES thread_comments(id) ON DELETE CASCADE,
  value       smallint  NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, comment_id),
  CONSTRAINT comment_votes_value_check CHECK (value IN (-1, 1))
);

CREATE INDEX comment_votes_comment_id_idx ON comment_votes (comment_id);

-- ============================================================
-- TABLE: saved_threads
-- ============================================================

CREATE TABLE saved_threads (
  user_id    uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  thread_id  uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, thread_id)
);

-- ============================================================
-- TABLE: thread_views
-- ============================================================

CREATE TABLE thread_views (
  thread_id  uuid        NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id    uuid        REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  viewed_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (thread_id, user_id, viewed_at)
);

CREATE INDEX thread_views_thread_viewed_idx
  ON thread_views (thread_id, viewed_at DESC);

-- ============================================================
-- TABLE: thread_flags
-- ============================================================

CREATE TABLE thread_flags (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id    uuid        REFERENCES threads(id) ON DELETE CASCADE,
  comment_id   uuid        REFERENCES thread_comments(id) ON DELETE CASCADE,
  reporter_id  uuid        NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  reason       text        NOT NULL,
  status       text        NOT NULL DEFAULT 'open',
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,

  CONSTRAINT thread_flags_xor_check
    CHECK (
      (thread_id IS NOT NULL AND comment_id IS NULL)
      OR
      (thread_id IS NULL AND comment_id IS NOT NULL)
    )
);

-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

-- Depth-2 enforcement: replies-to-replies are not allowed
CREATE OR REPLACE FUNCTION check_comment_depth() RETURNS trigger AS $$
BEGIN
  IF new.reply_to IS NOT NULL THEN
    IF (SELECT reply_to FROM thread_comments WHERE id = new.reply_to) IS NOT NULL THEN
      RAISE EXCEPTION 'comment depth exceeds 2 (replies to replies are not allowed)';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thread_comments_depth_check
  BEFORE INSERT OR UPDATE ON thread_comments
  FOR EACH ROW EXECUTE FUNCTION check_comment_depth();

-- Denormalized comments_count + last_activity_at on threads
CREATE OR REPLACE FUNCTION bump_thread_on_comment() RETURNS trigger AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE threads
      SET comments_count = comments_count + 1, last_activity_at = now()
      WHERE id = new.thread_id;
  ELSIF tg_op = 'UPDATE' AND old.deleted_at IS NULL AND new.deleted_at IS NOT NULL THEN
    UPDATE threads
      SET comments_count = GREATEST(comments_count - 1, 0)
      WHERE id = new.thread_id;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thread_comments_count_trigger
  AFTER INSERT OR UPDATE ON thread_comments
  FOR EACH ROW EXECUTE FUNCTION bump_thread_on_comment();

-- Denormalized vote_score on threads
CREATE OR REPLACE FUNCTION recompute_thread_vote_score() RETURNS trigger AS $$
BEGIN
  UPDATE threads SET
    vote_score = COALESCE((SELECT sum(value) FROM thread_votes WHERE thread_id = COALESCE(new.thread_id, old.thread_id)), 0),
    last_activity_at = now()
    WHERE id = COALESCE(new.thread_id, old.thread_id);
  RETURN COALESCE(new, old);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thread_votes_score_trigger
  AFTER INSERT OR UPDATE OR DELETE ON thread_votes
  FOR EACH ROW EXECUTE FUNCTION recompute_thread_vote_score();

-- Denormalized vote_score on thread_comments
CREATE OR REPLACE FUNCTION recompute_comment_vote_score() RETURNS trigger AS $$
BEGIN
  UPDATE thread_comments SET
    vote_score = COALESCE((SELECT sum(value) FROM comment_votes WHERE comment_id = COALESCE(new.comment_id, old.comment_id)), 0)
    WHERE id = COALESCE(new.comment_id, old.comment_id);
  RETURN COALESCE(new, old);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_votes_score_trigger
  AFTER INSERT OR UPDATE OR DELETE ON comment_votes
  FOR EACH ROW EXECUTE FUNCTION recompute_comment_vote_score();

-- ============================================================
-- hot_score SQL FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION hot_score(score int, last_activity timestamptz)
  RETURNS numeric AS $$
DECLARE
  abs_score   int     := GREATEST(ABS(score), 1);
  sign_factor int     := CASE WHEN score > 0 THEN 1 WHEN score < 0 THEN -1 ELSE 0 END;
  epoch_secs  numeric := EXTRACT(EPOCH FROM last_activity);
BEGIN
  RETURN (sign_factor * log(abs_score)) + ((epoch_secs - 1700000000) / 45000);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE threads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_comments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_votes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_votes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_threads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_views      ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_flags      ENABLE ROW LEVEL SECURITY;

-- READ: everyone can read non-deleted rows
CREATE POLICY threads_read       ON threads         FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY comments_read      ON thread_comments FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY thread_votes_read  ON thread_votes    FOR SELECT USING (true);
CREATE POLICY comment_votes_read ON comment_votes   FOR SELECT USING (true);
CREATE POLICY thread_views_read  ON thread_views    FOR SELECT USING (true);
CREATE POLICY saved_threads_read ON saved_threads   FOR SELECT USING (auth.uid() = user_id);

-- WRITE: authenticated only; ownership enforced
CREATE POLICY threads_insert     ON threads         FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY threads_update     ON threads         FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY comments_insert    ON thread_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY comments_update    ON thread_comments FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY thread_votes_write ON thread_votes    FOR ALL   USING (auth.uid() = user_id)   WITH CHECK (auth.uid() = user_id);
CREATE POLICY comment_votes_write ON comment_votes  FOR ALL   USING (auth.uid() = user_id)   WITH CHECK (auth.uid() = user_id);
CREATE POLICY saved_threads_write ON saved_threads  FOR ALL   USING (auth.uid() = user_id)   WITH CHECK (auth.uid() = user_id);
CREATE POLICY thread_views_insert ON thread_views   FOR INSERT WITH CHECK (true);
CREATE POLICY thread_flags_insert ON thread_flags   FOR INSERT WITH CHECK (auth.uid() = reporter_id);
