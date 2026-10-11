-- 20261011_audit_hardening.sql
--
-- Server-side enforcement for the issues found in the dramjournal.online audit.
-- Written to be idempotent and safe against tables that were created ad-hoc in
-- the dashboard (every table-dependent block is guarded by an existence check).
--
--   S1  subscriptions: clients can no longer self-approve a follow
--       (BEFORE INSERT/UPDATE trigger), and the admin auto-follow on signup
--       moves into an AFTER INSERT trigger on auth.users.
--   S4  pending_notifications / direct_messages: sender identity is stamped
--       from the JWT and recipients are validated against the social graph, so
--       the table can't be used as an email relay or to forge senders.
--   S10 get_user_id_by_email: authenticated-only + per-user rate limit.
--   S9  shared_whiskies / shared_wishlists: public SELECT replaced by
--       SECURITY DEFINER RPCs that fetch ONE share by id and strip owner ids.
--   P6  composite index for the gallery query.
--
-- BEFORE APPLYING
--   * Review the `INSERT INTO public.app_settings` note below and set your
--     admin e-mail so new users keep auto-following the admin account.
--   * Apply this migration BEFORE deploying the matching frontend (the share
--     pages now call the get_shared_* RPCs).
--
-- Triggers only act when auth.uid() IS NOT NULL (i.e. calls made with a user
-- JWT through PostgREST). Service-role scripts and internal triggers bypass
-- them by design.

BEGIN;

-- ── 0. Settings table (service-role only) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;      -- no policies → no client access
REVOKE ALL ON public.app_settings FROM anon, authenticated;
-- Set once, from the SQL editor (replaces the old public VITE_ADMIN_EMAILS):
--   INSERT INTO public.app_settings (key, value)
--   VALUES ('admin_email', 'you@example.com')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- UI-only admin probe (replaces the client-side VITE_ADMIN_EMAILS list, which
-- leaked the admin address in the public JS bundle). Real enforcement stays in RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(lower(auth.jwt() ->> 'email') IN (
    SELECT lower(trim(e)) FROM public.app_settings s, unnest(string_to_array(s.value, ',')) AS e
     WHERE s.key = 'admin_email'
  ), false);
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── 1. subscriptions: clients cannot self-approve ─────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_subscriptions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;   -- service role / internal triggers
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.follower_id IS DISTINCT FROM uid THEN
      RAISE EXCEPTION 'follower_id must be the authenticated user' USING ERRCODE = '42501';
    END IF;
    IF NEW.following_id = uid THEN
      RAISE EXCEPTION 'cannot follow yourself' USING ERRCODE = '42501';
    END IF;
    NEW.status         := 'pending';                    -- only the followed user may accept
    NEW.follower_email := lower(auth.jwt() ->> 'email'); -- no spoofed identities
    SELECT lower(u.email) INTO NEW.following_email FROM auth.users u WHERE u.id = NEW.following_id;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.follower_id  IS DISTINCT FROM OLD.follower_id
  OR NEW.following_id IS DISTINCT FROM OLD.following_id THEN
    RAISE EXCEPTION 'subscription parties are immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND OLD.following_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'only the followed user can change the status' USING ERRCODE = '42501';
  END IF;
  NEW.follower_email  := OLD.follower_email;
  NEW.following_email := OLD.following_email;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    DROP TRIGGER IF EXISTS trig_guard_subscriptions ON public.subscriptions;
    CREATE TRIGGER trig_guard_subscriptions
      BEFORE INSERT OR UPDATE ON public.subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.guard_subscriptions();
  END IF;
END $$;

-- Auto-follow the admin/creator account for every new user (was client-side).
CREATE OR REPLACE FUNCTION public.autofollow_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin_email text;
  admin_id    uuid;
BEGIN
  SELECT lower(trim(split_part(value, ',', 1))) INTO admin_email FROM public.app_settings WHERE key = 'admin_email';
  IF admin_email IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO admin_id FROM auth.users WHERE lower(email) = admin_email;
  IF admin_id IS NULL OR admin_id = NEW.id THEN RETURN NEW; END IF;

  INSERT INTO public.subscriptions (follower_id, following_id, status, follower_email, following_email)
  VALUES (NEW.id, admin_id, 'accepted', lower(NEW.email), admin_email)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;      -- never block signup
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    DROP TRIGGER IF EXISTS trig_autofollow_admin ON auth.users;
    CREATE TRIGGER trig_autofollow_admin
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.autofollow_admin();
  END IF;
END $$;

-- ── 2. pending_notifications: stamp sender, validate recipient ────────────────
CREATE OR REPLACE FUNCTION public.guard_pending_notifications()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  uid  uuid := auth.uid();
  me   text := lower(auth.jwt() ->> 'email');
  to_e text := lower(NEW.to_email);
  ok   boolean := false;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.from_email := me;
  NEW.to_email   := to_e;

  IF NEW.type = 'follow_request' THEN
    ok := EXISTS (SELECT 1 FROM public.subscriptions s
                  WHERE s.follower_id = uid AND lower(s.following_email) = to_e);
  ELSIF NEW.type = 'follow_accepted' THEN
    ok := EXISTS (SELECT 1 FROM public.subscriptions s
                  WHERE s.following_id = uid AND lower(s.follower_email) = to_e AND s.status = 'accepted');
  ELSIF NEW.type = 'direct_message' THEN
    ok := EXISTS (SELECT 1 FROM public.subscriptions s
                  WHERE s.following_id = uid AND lower(s.follower_email) = to_e AND s.status = 'accepted');
  ELSIF NEW.type = 'badge_earned' THEN
    ok := (to_e = me);
  ELSIF NEW.type LIKE 'feature\_request\_%' THEN
    -- Self, or a request owned by someone else (only visible to admins via RLS).
    ok := (to_e = me) OR EXISTS (SELECT 1 FROM public.feature_requests fr
                                 WHERE fr.user_id <> uid AND lower(fr.user_email) = to_e);
  END IF;

  IF NOT ok THEN
    RAISE EXCEPTION 'notification not permitted' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pending_notifications') THEN
    DROP TRIGGER IF EXISTS trig_guard_pending_notifications ON public.pending_notifications;
    CREATE TRIGGER trig_guard_pending_notifications
      BEFORE INSERT ON public.pending_notifications
      FOR EACH ROW EXECUTE FUNCTION public.guard_pending_notifications();
  END IF;
END $$;

-- ── 3. direct_messages: sender is the caller; recipients must be followers ────
-- (The cron job e-mails feature-request messages straight from this table, so
--  an unchecked insert here is also an e-mail relay.)
CREATE OR REPLACE FUNCTION public.email_of_user(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT lower(u.email) FROM auth.users u WHERE u.id = p_user;
$$;
REVOKE ALL ON FUNCTION public.email_of_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_of_user(uuid) TO authenticated;

-- SECURITY INVOKER on purpose: the feature-request branch relies on the
-- caller's own RLS view of public.feature_requests (only admins can see other
-- users' requests). A SECURITY DEFINER function would bypass that.
CREATE OR REPLACE FUNCTION public.guard_direct_messages()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  ok  boolean := false;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'sender_id must be the authenticated user' USING ERRCODE = '42501';
  END IF;
  NEW.sender_email    := lower(auth.jwt() ->> 'email');
  NEW.recipient_email := public.email_of_user(NEW.recipient_id);

  IF (NEW.whisky_payload ->> 'msg_type') = 'feature_request' THEN
    ok := EXISTS (SELECT 1 FROM public.feature_requests fr
                  WHERE fr.user_id = NEW.recipient_id AND fr.user_id <> uid);
  ELSE
    ok := EXISTS (SELECT 1 FROM public.subscriptions s
                  WHERE s.following_id = uid AND s.follower_id = NEW.recipient_id AND s.status = 'accepted');
  END IF;

  IF NOT ok THEN
    RAISE EXCEPTION 'message not permitted' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'direct_messages')
     AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feature_requests') THEN
    DROP TRIGGER IF EXISTS trig_guard_direct_messages ON public.direct_messages;
    CREATE TRIGGER trig_guard_direct_messages
      BEFORE INSERT ON public.direct_messages
      FOR EACH ROW EXECUTE FUNCTION public.guard_direct_messages();
  END IF;
END $$;

-- ── 4. get_user_id_by_email: authenticated only + rate limited ────────────────
CREATE TABLE IF NOT EXISTS public.rpc_call_log (
  user_id   uuid        NOT NULL,
  fn        text        NOT NULL,
  called_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rpc_call_log_user_fn_idx ON public.rpc_call_log (user_id, fn, called_at DESC);
ALTER TABLE public.rpc_call_log ENABLE ROW LEVEL SECURITY;        -- no policies → definer functions only
REVOKE ALL ON public.rpc_call_log FROM anon, authenticated;

DROP FUNCTION IF EXISTS public.get_user_id_by_email(text);
CREATE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid   uuid := auth.uid();
  calls int;
  result uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.rpc_call_log WHERE called_at < now() - interval '1 day';
  SELECT count(*) INTO calls FROM public.rpc_call_log
   WHERE user_id = uid AND fn = 'get_user_id_by_email' AND called_at > now() - interval '1 hour';
  IF calls >= 30 THEN
    RAISE EXCEPTION 'rate limit exceeded' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.rpc_call_log (user_id, fn) VALUES (uid, 'get_user_id_by_email');

  SELECT id INTO result FROM auth.users WHERE lower(email) = lower(trim(p_email));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;

-- ── 5. Public shares: fetch-one-by-id RPCs instead of a world-readable table ──
-- share_id may be uuid or text; the literal is coerced to the column type (so
-- the PK index is used) and any cast error simply yields NULL.
CREATE OR REPLACE FUNCTION public.get_shared_whisky(p_share_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE format(
    'SELECT (payload::jsonb) - %L - %L FROM public.shared_whiskies WHERE share_id = %L LIMIT 1',
    'user_id', 'owner', p_share_id
  ) INTO result;
  RETURN result;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shared_wishlist(p_share_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE format($q$
    SELECT jsonb_build_object(
             'shared_at', (payload::jsonb) -> 'shared_at',
             'items', COALESCE((
               SELECT jsonb_agg(i - 'user_id')
                 FROM jsonb_array_elements(COALESCE((payload::jsonb) -> 'items', '[]'::jsonb)) AS i
             ), '[]'::jsonb))
      FROM public.shared_wishlists WHERE share_id = %L LIMIT 1
  $q$, p_share_id) INTO result;
  RETURN result;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_whisky(text)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shared_wishlist(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_whisky(text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_wishlist(text) TO anon, authenticated;

-- Replace world-readable SELECT policies with owner-only ones.
DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shared_whiskies') THEN
    FOR pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'shared_whiskies'
                 AND cmd = 'SELECT' AND trim(both '() ' FROM coalesce(qual, '')) = 'true'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.shared_whiskies', pol.policyname);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_whiskies' AND policyname = 'shared_whiskies_owner_select') THEN
      CREATE POLICY shared_whiskies_owner_select ON public.shared_whiskies
        FOR SELECT USING ((payload ->> 'user_id') = auth.uid()::text);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shared_wishlists') THEN
    FOR pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'shared_wishlists'
                 AND cmd = 'SELECT' AND trim(both '() ' FROM coalesce(qual, '')) = 'true'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.shared_wishlists', pol.policyname);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_wishlists' AND policyname = 'shared_wishlists_owner_select') THEN
      CREATE POLICY shared_wishlists_owner_select ON public.shared_wishlists
        FOR SELECT USING ((payload ->> 'owner') = auth.uid()::text);
    END IF;
  END IF;
END $$;

-- ── 6. Gallery index: queries filter by user_id, then sort by date ────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whiskies') THEN
    CREATE INDEX IF NOT EXISTS whiskies_user_date_idx ON public.whiskies (user_id, date DESC NULLS LAST);
  END IF;
END $$;

COMMIT;
