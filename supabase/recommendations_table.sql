-- Run this in your Supabase SQL Editor
-- Creates the recommendations table with RLS

create table if not exists recommendations (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  payload      jsonb        not null default '[]',
  generated_at timestamptz  not null default now()
);

-- Enable Row Level Security
alter table recommendations enable row level security;

-- Users can only read their own recommendations
create policy "Users can read own recommendations"
  on recommendations
  for select
  using (auth.uid() = user_id);

-- Only the service role (used by the GitHub Action) can insert/update
-- The anon key cannot write to this table
create policy "Service role can upsert recommendations"
  on recommendations
  for all
  using (true)
  with check (true);
