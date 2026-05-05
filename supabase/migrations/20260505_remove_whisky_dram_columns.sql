-- Remove dram_count and last_dram_at columns from whiskies table
-- The system now uses only dram_logs table to track tasting history

-- Drop the trigger that updates whiskies table on dram_logs insert
DROP TRIGGER IF EXISTS trig_bump_whisky_dram_count ON public.dram_logs;

-- Drop the function that bumps dram_count and last_dram_at
DROP FUNCTION IF EXISTS public.bump_whisky_dram_count();

-- Remove columns from whiskies table
ALTER TABLE public.whiskies
  DROP COLUMN IF EXISTS dram_count,
  DROP COLUMN IF EXISTS last_dram_at;
