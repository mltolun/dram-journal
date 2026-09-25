-- 20260925_catalogue_search_indexes.sql
--
-- Makes catalogue search fast and cheap:
--   1. pg_trgm GIN indexes so leading-wildcard ILIKE (`%term%`) on
--      name / distillery / country can use an index instead of a full scan.
--   2. catalogue_search() — a single, indexed, server-ranked query used by
--      src/composables/useCatalogue.js (replaces the previous 2–5 sequential
--      client round trips).
--   3. catalogue_distinct_values() — server-side DISTINCT + LIMIT for the
--      distillery/country field autocomplete (src/components/Autocomplete.vue).
--
-- Idempotent and safe against a catalogue table that was created ad-hoc in the
-- Supabase dashboard (every statement is guarded by an existence check), so it
-- is safe to re-run.

BEGIN;

-- Ensure the pg_trgm operator class (gin_trgm_ops) resolves whether the
-- extension lives in `public` or Supabase's `extensions` schema.
SET search_path = public, extensions;

-- Trigram matching powers indexed `ILIKE '%…%'` searches.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 1. Indexes ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'catalogue') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'catalogue' AND indexname = 'catalogue_name_trgm_idx') THEN
    EXECUTE 'CREATE INDEX catalogue_name_trgm_idx ON public.catalogue USING gin (name gin_trgm_ops)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'catalogue' AND indexname = 'catalogue_distillery_trgm_idx') THEN
    EXECUTE 'CREATE INDEX catalogue_distillery_trgm_idx ON public.catalogue USING gin (distillery gin_trgm_ops)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'catalogue' AND indexname = 'catalogue_country_trgm_idx') THEN
    EXECUTE 'CREATE INDEX catalogue_country_trgm_idx ON public.catalogue USING gin (country gin_trgm_ops)';
  END IF;
END $$;

-- ── 2. Single server-ranked search query ──────────────────────────────────────
-- p_words is the noise-stripped keyword list computed in JS (cleanSearchQuery),
-- so the stop-word list lives in exactly one place. The WHERE/ORDER clauses are
-- built as explicit ILIKE constants (safely quoted with %L) so the planner can
-- use the trigram indexes for every term — including word-only matches — with no
-- correlated subquery per row. Candidates are ranked, then capped by p_limit, so
-- the best matches survive the LIMIT instead of being cut off alphabetically.
CREATE OR REPLACE FUNCTION public.catalogue_search(
  p_raw   text,
  p_words text[],
  p_limit int DEFAULT 30
)
RETURNS SETOF public.catalogue
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  pats        text[] := coalesce(p_words, '{}'::text[]);
  clauses     text[] := ARRAY[]::text[];
  score_parts text[] := ARRAY[]::text[];
  raw_pat     text   := '%' || coalesce(p_raw, '') || '%';
  w           text;
BEGIN
  -- Raw phrase (strongest signal).
  clauses     := clauses     || format('c.name ILIKE %L', raw_pat)
              || format('c.distillery ILIKE %L', raw_pat);
  score_parts := score_parts || format('(CASE WHEN c.name ILIKE %L THEN 8 ELSE 0 END)', raw_pat)
              || format('(CASE WHEN c.distillery ILIKE %L THEN 4 ELSE 0 END)', raw_pat);

  -- Individually cleaned keywords (weaker, recall-oriented signal).
  FOREACH w IN ARRAY pats LOOP
    clauses     := clauses     || format('c.name ILIKE %L', '%' || w || '%')
                || format('c.distillery ILIKE %L', '%' || w || '%');
    score_parts := score_parts || format('(CASE WHEN c.name ILIKE %L THEN 2 ELSE 0 END)', '%' || w || '%')
                || format('(CASE WHEN c.distillery ILIKE %L THEN 1 ELSE 0 END)', '%' || w || '%');
  END LOOP;

  RETURN QUERY EXECUTE format(
    'SELECT c.* FROM public.catalogue c WHERE %s ORDER BY (%s) DESC, c.name ASC LIMIT %s',
    array_to_string(clauses, ' OR '),
    array_to_string(score_parts, ' + '),
    greatest(coalesce(p_limit, 30), 1)
  );
END;
$$;

-- ── 3. Distinct autocomplete values ───────────────────────────────────────────
-- Replaces fetching 50 full rows and de-duplicating in the browser. Only the two
-- autocomplete columns are allowed, which keeps the dynamic SQL injection-safe.
CREATE OR REPLACE FUNCTION public.catalogue_distinct_values(
  p_column text,
  p_query  text,
  p_limit  int DEFAULT 12
)
RETURNS SETOF text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  col text := lower(trim(coalesce(p_column, '')));
BEGIN
  IF col NOT IN ('distillery', 'country') THEN
    RAISE EXCEPTION 'unsupported catalogue column: %', p_column;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT DISTINCT %I FROM public.catalogue '
    'WHERE %I ILIKE $1 AND %I IS NOT NULL '
    'ORDER BY %I ASC LIMIT $2',
    col, col, col, col
  ) USING '%' || coalesce(p_query, '') || '%', greatest(coalesce(p_limit, 12), 1);
END;
$$;

COMMIT;
