-- 20261011120000_feed_badges_flavour_research.sql
--
-- Follow-ups from the post-deploy check:
--   1. activity_feed accepted only 'journal_add' and 'rating', so 'wishlist_add'
--      and 'dram_logged' inserts were rejected (HTTP 400) and never reached followers.
--   2. pending_notifications did not allow 'badge_earned', so badge e-mails were
--      never queued.
--   3. shared_wishlists had no UPDATE policy, so re-sharing a wishlist silently
--      kept the old contents.
--   4. Catalogue flavour profiles get provenance columns so the web-research job
--      can record where each score came from, what it replaced, and when.

BEGIN;

-- ── 1. activity_feed: every type the client writes ───────────────────────────
ALTER TABLE public.activity_feed DROP CONSTRAINT IF EXISTS activity_feed_type_check;
ALTER TABLE public.activity_feed ADD CONSTRAINT activity_feed_type_check
  CHECK (type = ANY (ARRAY['journal_add', 'rating', 'wishlist_add', 'dram_logged']));

-- ── 2. pending_notifications: badge e-mails ──────────────────────────────────
ALTER TABLE public.pending_notifications DROP CONSTRAINT IF EXISTS pending_notifications_type_check;
ALTER TABLE public.pending_notifications ADD CONSTRAINT pending_notifications_type_check
  CHECK (type = ANY (ARRAY[
    'follow_request', 'follow_accepted', 'direct_message', 'badge_earned',
    'feature_request_accepted', 'feature_request_in_progress',
    'feature_request_done', 'feature_request_declined'
  ]));

-- ── 3. shared_wishlists: owners can update their own share ───────────────────
DROP POLICY IF EXISTS shared_wishlists_owner_update ON public.shared_wishlists;
CREATE POLICY shared_wishlists_owner_update ON public.shared_wishlists
  FOR UPDATE
  USING ((payload ->> 'owner') = auth.uid()::text)
  WITH CHECK ((payload ->> 'owner') = auth.uid()::text);

-- ── 4. catalogue: flavour provenance ─────────────────────────────────────────
ALTER TABLE public.catalogue
  ADD COLUMN IF NOT EXISTS flavor_method        text  NOT NULL DEFAULT 'llm-only',
  ADD COLUMN IF NOT EXISTS flavor_sources       jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS flavor_confidence    real,
  ADD COLUMN IF NOT EXISTS flavor_researched_at timestamptz,
  ADD COLUMN IF NOT EXISTS flavor_previous      jsonb;

CREATE INDEX IF NOT EXISTS catalogue_flavor_researched_idx
  ON public.catalogue (flavor_researched_at ASC NULLS FIRST);

COMMIT;
