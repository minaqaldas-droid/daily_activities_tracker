-- ============================================
-- MIGRATION: Move from legacy local password table
-- to Supabase Auth + profile table
-- ============================================

BEGIN;

ALTER TABLE IF EXISTS public.users RENAME TO legacy_users;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'superadmin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

INSERT INTO public.users (id, email, name, role, created_at)
SELECT
  auth_user.id,
  COALESCE(auth_user.email, legacy.email),
  COALESCE(NULLIF(legacy.name, ''), NULLIF(auth_user.raw_user_meta_data ->> 'name', ''), split_part(COALESCE(auth_user.email, legacy.email), '@', 1)),
  CASE WHEN legacy.role = 'superadmin' THEN 'superadmin' ELSE 'user' END,
  COALESCE(legacy.created_at, timezone('utc', now()))
FROM public.legacy_users AS legacy
JOIN auth.users AS auth_user
  ON lower(auth_user.email) = lower(legacy.email)
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role;

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS system TEXT NOT NULL DEFAULT '';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS instrument TEXT NOT NULL DEFAULT '';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS comments TEXT NOT NULL DEFAULT '';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS editedBy TEXT;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS performer_mode TEXT NOT NULL DEFAULT 'manual';

COMMIT;

-- After this migration:
-- 1. Run the updated SUPABASE_SETUP.sql to create RLS policies and auth sync trigger.
-- 2. Ask existing users to reset/create their passwords through Supabase Auth.
-- 3. When you have verified the new setup, you can archive or drop public.legacy_users.
