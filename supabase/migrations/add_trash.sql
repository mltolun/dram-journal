-- Add deleted_at column to support soft-delete / trash feature
ALTER TABLE whiskies ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
