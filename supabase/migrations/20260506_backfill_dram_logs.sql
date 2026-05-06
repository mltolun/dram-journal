-- Backfill dram_logs for existing journal whiskies that don't have one yet.
-- This handles the period before the dram_logs table existed.

INSERT INTO public.dram_logs (user_id, whisky_id, whisky_name, whisky_distillery, tasted_at, rating, notes, created_at)
SELECT
  w.user_id,
  w.id            AS whisky_id,
  w.name           AS whisky_name,
  w.distillery     AS whisky_distillery,
  w.created_at AS tasted_at,
  NULLIF(w.rating, 0) AS rating,
  w.notes,
  w.created_at
FROM public.whiskies w
WHERE w.list = 'journal'
  AND NOT EXISTS (
    SELECT 1 FROM public.dram_logs d WHERE d.whisky_id = w.id
  )
