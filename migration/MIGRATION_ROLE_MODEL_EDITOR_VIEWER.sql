-- ============================================
-- MIGRATION: Introduce role model (admin/editor/viewer)
-- ============================================

BEGIN;

-- 1) Relax/replace existing role constraint first, so data updates are allowed.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'superadmin', 'viewer', 'editor', 'admin'));

-- 2) Align legacy role values.
UPDATE public.users
SET role = 'viewer'
WHERE role = 'user';

UPDATE public.users
SET role = 'admin'
WHERE role = 'superadmin';

-- 3) Tighten allowed role values to final model.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('viewer', 'editor', 'admin'));

ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'viewer';

-- 4) Align default permissions with the new role model.
ALTER TABLE public.users
  ALTER COLUMN permissions SET DEFAULT '{"dashboard": true, "add": false, "edit": false, "search": true, "import": false, "export": true, "edit_action": false, "delete_action": false}'::jsonb;

UPDATE public.users
SET permissions = CASE role
  WHEN 'admin' THEN '{"dashboard": true, "add": true, "edit": true, "search": true, "import": true, "export": true, "edit_action": true, "delete_action": true}'::jsonb
  WHEN 'editor' THEN '{"dashboard": true, "add": true, "edit": true, "search": true, "import": true, "export": true, "edit_action": true, "delete_action": true}'::jsonb
  ELSE '{"dashboard": true, "add": false, "edit": false, "search": true, "import": false, "export": true, "edit_action": false, "delete_action": false}'::jsonb
END;

-- 4) New auth users should be created as viewer.
CREATE OR REPLACE FUNCTION public.sync_auth_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'name', ''), split_part(NEW.email, '@', 1)),
    'viewer'
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
