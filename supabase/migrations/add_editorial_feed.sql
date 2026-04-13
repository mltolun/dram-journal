-- ── editorial_feed ──────────────────────────────────────────────────────────
-- Website-curated content: news, events, awards, and announcements from the
-- whisky world. Rows are inserted by admins or scheduled scripts.
-- All authenticated users can read; only service-role (scripts/admin) can write.
-- Run once in the Supabase SQL editor: Database → SQL Editor → New query.

CREATE TABLE IF NOT EXISTS public.editorial_feed (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT        NOT NULL CHECK (type IN ('news', 'event', 'award', 'announcement')),
  title         TEXT        NOT NULL,
  body          TEXT,                            -- optional short description / teaser
  image_url     TEXT,                            -- optional header image
  source_name   TEXT,                            -- e.g. "Whisky Magazine", "The Whisky Exchange"
  source_url    TEXT,                            -- external link
  event_date    DATE,                            -- for type='event': when it takes place
  location      TEXT,                            -- for type='event': where
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,                     -- hide item after this date (optional)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- All authenticated users can read editorial content.
ALTER TABLE public.editorial_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read editorial feed"
  ON public.editorial_feed
  FOR SELECT
  USING (
    -- Only show items that haven't expired
    (expires_at IS NULL OR expires_at > NOW())
  );

-- Index for reverse-chronological queries
CREATE INDEX IF NOT EXISTS editorial_feed_published_at_idx
  ON public.editorial_feed (published_at DESC);
