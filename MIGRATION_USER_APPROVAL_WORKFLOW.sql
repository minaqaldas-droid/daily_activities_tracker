-- ============================================
-- MIGRATION: Admin approval workflow for new users
-- ============================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_is_approved ON public.users(is_approved);

-- Keep existing users active so current accounts are not blocked.
UPDATE public.users
SET
  is_approved = true,
  approved_at = COALESCE(approved_at, timezone('utc', now()))
WHERE is_approved = false;

CREATE OR REPLACE FUNCTION public.sync_auth_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, is_approved, approval_requested_at, approved_at, approved_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'name', ''), split_part(NEW.email, '@', 1)),
    'user',
    false,
    timezone('utc', now()),
    NULL,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(NULLIF(EXCLUDED.name, ''), public.users.name),
    approval_requested_at = COALESCE(public.users.approval_requested_at, timezone('utc', now()));

  UPDATE public.users
  SET
    is_approved = false,
    approved_at = NULL,
    approved_by = NULL,
    approval_requested_at = timezone('utc', now())
  WHERE id = NEW.id
    AND (
      TG_OP = 'INSERT'
      OR (public.users.is_approved IS TRUE AND NEW.confirmed_at IS NULL)
    );

  RETURN NEW;
END;
$$;

COMMIT;
