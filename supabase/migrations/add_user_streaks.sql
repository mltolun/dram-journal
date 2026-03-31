-- ── user_streaks ───────────────────────────────────────────────────────────────
-- Tracks per-user weekly streaks and re-engagement email state.
-- Run this once in the Supabase SQL editor (Database → SQL Editor → New query).

CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id                    UUID        PRIMARY KEY,
  -- Streak counters
  current_streak             INT         NOT NULL DEFAULT 0,
  best_streak                INT         NOT NULL DEFAULT 0,
  last_logged_week           TEXT,                              -- ISO week e.g. '2026-W13'
  -- Personalised send-time (derived from logging history)
  preferred_dow              INT,                               -- 0=Sun … 6=Sat; NULL = no preference
  -- Re-engagement email state
  reengagement_emails_sent   INT         NOT NULL DEFAULT 0,    -- reset to 0 when user returns
  last_reengagement_sent_at  TIMESTAMPTZ,
  streak_warned_week         TEXT,                              -- ISO week of last streak-warning email
  -- Housekeeping
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- Users can read their own row (e.g. to show streak in the UI later).
-- The GitHub Actions scripts use the service-role key, which bypasses RLS.
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streak"
  ON public.user_streaks
  FOR SELECT
  USING (auth.uid() = user_id);
