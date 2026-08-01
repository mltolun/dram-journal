-- 20260801_security_and_sync.sql
--
-- Idempotent hardening migration. Safe to re-run and safe against tables that
-- were originally created ad-hoc in the Supabase dashboard — every statement is
-- guarded by existence checks.
--
--   1. Version-control owner-scoped RLS on `whiskies`.
--   2. Add a "followed users" SELECT policy on `dram_logs` so the social timeline
--      (src/composables/useFeed.js) can read accepted followers' tastings.
--   3. Re-add a trigger keeping dram_logs name/distillery snapshots in sync when
--      a whisky is renamed or its distillery edited.
--   4. UNIQUE constraint on editorial_feed.source_url (required by the
--      fetch-editorial-feed.js upsert dedup).
--   5. Index on whiskies.date (gallery sort column).
--   6. UNIQUE(user_id, badge_id) on user_badges (badge dedupe).
--   7. claim/release_reengagement_slot RPCs for the atomic freq-cap.
--   8. recommendations.sent_week column (weekly email dedupe guard).

BEGIN;

-- ── 1. whiskies: owner-scoped RLS ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whiskies') THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.whiskies ENABLE ROW LEVEL SECURITY';

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whiskies' AND policyname = 'whiskies_owner_select') THEN
    EXECUTE 'CREATE POLICY whiskies_owner_select ON public.whiskies FOR SELECT USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whiskies' AND policyname = 'whiskies_owner_insert') THEN
    EXECUTE 'CREATE POLICY whiskies_owner_insert ON public.whiskies FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whiskies' AND policyname = 'whiskies_owner_update') THEN
    EXECUTE 'CREATE POLICY whiskies_owner_update ON public.whiskies FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whiskies' AND policyname = 'whiskies_owner_delete') THEN
    EXECUTE 'CREATE POLICY whiskies_owner_delete ON public.whiskies FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- ── 2. dram_logs: read accepted followers' tastings (social timeline) ─────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dram_logs' AND policyname = 'dram_logs_following_read') THEN
    EXECUTE 'CREATE POLICY dram_logs_following_read ON public.dram_logs FOR SELECT USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.follower_id = auth.uid() AND s.following_id = dram_logs.user_id AND s.status = ''accepted''))';
  END IF;
END $$;

-- ── 3. Keep dram_logs snapshots in sync with whiskies ─────────────────────────
CREATE OR REPLACE FUNCTION public.sync_dram_logs_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name OR NEW.distillery IS DISTINCT FROM OLD.distillery THEN
    UPDATE public.dram_logs
    SET whisky_name       = NEW.name,
        whisky_distillery = NEW.distillery
    WHERE whisky_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_sync_dram_logs_snapshot ON public.whiskies;
CREATE TRIGGER trig_sync_dram_logs_snapshot
AFTER UPDATE ON public.whiskies
FOR EACH ROW
EXECUTE FUNCTION public.sync_dram_logs_snapshot();

-- ── 4. editorial_feed.source_url UNIQUE (dedupe for the daily feed job) ───────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'editorial_feed') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'editorial_feed_source_url_key'
                   AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    -- Remove any pre-existing duplicates first (keep the newest per URL)
    DELETE FROM public.editorial_feed a
    USING public.editorial_feed b
    WHERE a.source_url = b.source_url
      AND a.id <> b.id
      AND a.created_at > b.created_at;

    EXECUTE 'ALTER TABLE public.editorial_feed ADD CONSTRAINT editorial_feed_source_url_key UNIQUE (source_url)';
  END IF;
END $$;

-- ── 5. Index the gallery sort column ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whiskies') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'whiskies' AND indexname = 'whiskies_date_idx') THEN
    EXECUTE 'CREATE INDEX whiskies_date_idx ON public.whiskies (date DESC NULLS LAST)';
  END IF;
END $$;

-- ── 6. user_badges dedupe constraint ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_badges') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'user_badges_user_badge_key'
                   AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    EXECUTE 'ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_user_badge_key UNIQUE (user_id, badge_id)';
  END IF;
END $$;

-- ── 7. Atomic re-engagement slot claim (freq-cap) ─────────────────────────────
-- process-reengagement.js claims a user's send slot with these RPCs so that
-- overlapping runs (daily cron + manual workflow_dispatch) can't both pass the
-- 7-day frequency cap. `claim` locks the row (SELECT ... FOR UPDATE) and stamps
-- last_reengagement_sent_at; `release` is only invoked by the claim owner on
-- send failure so the user can be retried on the next run.
CREATE OR REPLACE FUNCTION public.claim_reengagement_slot(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  rec public.user_streaks%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_streaks') THEN
    RETURN true;
  END IF;

  SELECT * INTO rec FROM public.user_streaks WHERE user_id = p_user_id FOR UPDATE;

  IF rec.user_id IS NULL THEN
    INSERT INTO public.user_streaks (user_id, last_reengagement_sent_at, updated_at)
    VALUES (p_user_id, now(), now());
    RETURN true;
  END IF;

  IF rec.last_reengagement_sent_at IS NOT NULL
     AND rec.last_reengagement_sent_at > now() - interval '7 days' THEN
    RETURN false;
  END IF;

  UPDATE public.user_streaks
     SET last_reengagement_sent_at = now(),
         updated_at                = now()
   WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_reengagement_slot(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_streaks') THEN
    UPDATE public.user_streaks
       SET last_reengagement_sent_at = NULL,
           updated_at                = now()
     WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- ── 8. recommendations.sent_week (weekly email dedupe) ────────────────────────
-- generate-recommendations.js stamps the ISO week here only after an email has
-- actually been sent, so re-running the cron can't double-email anyone.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recommendations') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'recommendations' AND column_name = 'sent_week') THEN
    EXECUTE 'ALTER TABLE public.recommendations ADD COLUMN sent_week TEXT';
  END IF;
END $$;

COMMIT;
