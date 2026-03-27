-- ── Catalogue table ──────────────────────────────────────────────────────────
create table if not exists catalogue (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  distillery  text,
  country     text,                -- e.g. "Ireland"
  region      text,                -- e.g. "Speyside"
  type        text,                -- mapped: scotch | irish | bourbon | japanese | other
  age         text,
  abv         text,
  price_band  text,                -- e.g. "€20–€40"
  photo_url   text,                -- null until R2 migration
  nose        text,                -- filled later via Gemini batch
  palate      text,                -- filled later via Gemini batch
  dulzor      integer default 0,
  ahumado     integer default 0,
  cuerpo      integer default 0,
  frutado     integer default 0,
  especiado   integer default 0,
  created_at  timestamptz default now()
);

-- Only authenticated users can read the catalogue
alter table catalogue enable row level security;

create policy "Authenticated users can read catalogue"
  on catalogue for select
  to authenticated
  using (true);

-- Only service role can insert/update (admin import script + future Gemini batch)
create policy "Service role can manage catalogue"
  on catalogue for all
  to service_role
  using (true);

-- ── Add catalogue_id to whiskies ──────────────────────────────────────────────
alter table whiskies
  add column if not exists catalogue_id uuid references catalogue(id) on delete set null,
  add column if not exists region text;  -- in case user adds manually with a region

-- Index for fast search
create index if not exists catalogue_name_idx       on catalogue using gin(to_tsvector('english', name));
create index if not exists catalogue_distillery_idx on catalogue using gin(to_tsvector('english', coalesce(distillery, '')));
