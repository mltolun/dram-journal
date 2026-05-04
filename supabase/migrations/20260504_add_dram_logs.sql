-- Repeat dram / tasting session log
-- Stores each additional tasting separately so the same whisky can be logged
-- multiple times over time without duplicating the bottle record itself.

CREATE TABLE IF NOT EXISTS public.dram_logs (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whisky_id          BIGINT      NOT NULL REFERENCES public.whiskies(id) ON DELETE CASCADE,
  whisky_name        TEXT        NOT NULL,
  whisky_distillery  TEXT,
  tasted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rating             INT         CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.dram_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own dram logs"
  ON public.dram_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dram logs"
  ON public.dram_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.whiskies w
      WHERE w.id = whisky_id
        AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own dram logs"
  ON public.dram_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.whiskies w
      WHERE w.id = whisky_id
        AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own dram logs"
  ON public.dram_logs
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS dram_logs_user_tasted_idx
  ON public.dram_logs (user_id, tasted_at DESC);

CREATE INDEX IF NOT EXISTS dram_logs_whisky_tasted_idx
  ON public.dram_logs (whisky_id, tasted_at DESC);

ALTER TABLE public.whiskies
  ADD COLUMN IF NOT EXISTS dram_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dram_at TIMESTAMPTZ;

UPDATE public.whiskies
SET
  dram_count = 1,
  last_dram_at = COALESCE(last_dram_at, created_at)
WHERE list = 'journal' AND COALESCE(dram_count, 0) = 0;

CREATE OR REPLACE FUNCTION public.bump_whisky_dram_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.whiskies
  SET
    dram_count = COALESCE(dram_count, 0) + 1,
    last_dram_at = CASE
      WHEN last_dram_at IS NULL THEN NEW.tasted_at
      WHEN NEW.tasted_at > last_dram_at THEN NEW.tasted_at
      ELSE last_dram_at
    END
  WHERE id = NEW.whisky_id
    AND user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_bump_whisky_dram_count ON public.dram_logs;
CREATE TRIGGER trig_bump_whisky_dram_count
AFTER INSERT ON public.dram_logs
FOR EACH ROW
EXECUTE FUNCTION public.bump_whisky_dram_count();
