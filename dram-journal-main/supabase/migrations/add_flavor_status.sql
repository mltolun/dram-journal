-- Add flavor_status column to catalogue for tracking generation progress
-- Values: NULL = not processed, 'done' = complete, 'error' = failed last attempt

ALTER TABLE catalogue
  ADD COLUMN IF NOT EXISTS flavor_status text;

-- Index for fast querying of unprocessed whiskies
CREATE INDEX IF NOT EXISTS catalogue_flavor_status_idx ON catalogue (flavor_status);
