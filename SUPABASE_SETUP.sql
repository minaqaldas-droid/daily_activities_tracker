-- ============================================
-- SUPABASE SQL SETUP SCRIPT
-- Daily Activities Tracker
-- Auth-backed schema with RLS
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL DEFAULT '',
  performer TEXT NOT NULL,
  system TEXT NOT NULL DEFAULT '',
  shift TEXT NOT NULL DEFAULT '',
  permit_number TEXT NOT NULL DEFAULT '',
  instrument_type TEXT NOT NULL DEFAULT '',
  "activityType" TEXT NOT NULL DEFAULT '' CHECK ("activityType" IN ('', 'PM', 'CM', 'Mod')),
  tag TEXT NOT NULL DEFAULT '',
  problem TEXT NOT NULL,
  action TEXT NOT NULL,
  comments TEXT NOT NULL DEFAULT '',
  editedBy TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  avatar_url TEXT NOT NULL DEFAULT '',
  preferred_primary_color TEXT NOT NULL DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '{"dashboard": true, "add": false, "edit": false, "search": true, "import": false, "export": true, "edit_action": false, "delete_action": false}'::jsonb,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approval_requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webapp_name TEXT NOT NULL DEFAULT 'Daily Activities Tracker',
  logo_url TEXT NOT NULL DEFAULT '',
  browser_tab_name TEXT NOT NULL DEFAULT 'Daily Activities Tracker',
  favicon_url TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#667eea',
  performer_mode TEXT NOT NULL DEFAULT 'manual' CHECK (performer_mode IN ('manual', 'auto')),
  header_font_family TEXT NOT NULL DEFAULT '',
  header_font_size TEXT NOT NULL DEFAULT '2.5rem',
  subheader_font_family TEXT NOT NULL DEFAULT '',
  subheader_font_size TEXT NOT NULL DEFAULT '1.5rem',
  sidebar_font_family TEXT NOT NULL DEFAULT '',
  sidebar_font_size TEXT NOT NULL DEFAULT '0.95rem',
  activity_field_config JSONB NOT NULL DEFAULT '{"date": {"enabled": true, "required": true, "order": 10}, "performer": {"enabled": true, "required": true, "order": 20}, "system": {"enabled": true, "required": true, "order": 30}, "shift": {"enabled": false, "required": false, "order": 40}, "permitNumber": {"enabled": false, "required": false, "order": 50}, "instrumentType": {"enabled": false, "required": false, "order": 60}, "activityType": {"enabled": true, "required": true, "order": 70}, "tag": {"enabled": true, "required": true, "order": 80}, "problem": {"enabled": true, "required": true, "order": 90}, "action": {"enabled": true, "required": true, "order": 100}, "comments": {"enabled": true, "required": false, "order": 110}}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_date ON public.activities(date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_performer ON public.activities(performer);
CREATE INDEX IF NOT EXISTS idx_activities_tag ON public.activities(tag);
CREATE INDEX IF NOT EXISTS idx_activities_system ON public.activities(system);
CREATE INDEX IF NOT EXISTS idx_activities_shift ON public.activities(shift);
CREATE INDEX IF NOT EXISTS idx_activities_permit_number ON public.activities(permit_number);
CREATE INDEX IF NOT EXISTS idx_activities_instrument_type ON public.activities(instrument_type);
CREATE INDEX IF NOT EXISTS idx_activities_activity_type ON public.activities("activityType");
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_approved ON public.users(is_approved);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.has_feature_permission(feature_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT
        CASE
          WHEN role = 'admin' THEN TRUE
          ELSE COALESCE((permissions ->> feature_name)::boolean, FALSE)
        END
      FROM public.users
      WHERE id = auth.uid()
      LIMIT 1
    ),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only Admin users can delete accounts.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account.';
  END IF;

  DELETE FROM auth.users
  WHERE id = target_user_id;
END;
$$;

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

DROP TRIGGER IF EXISTS on_auth_user_profile_changed ON auth.users;

CREATE TRIGGER on_auth_user_profile_changed
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_auth_user_profile();

INSERT INTO public.settings (webapp_name, logo_url, browser_tab_name, favicon_url, primary_color, performer_mode)
SELECT 'Daily Activities Tracker', '', 'Daily Activities Tracker', '', '#667eea', 'manual'
WHERE NOT EXISTS (
  SELECT 1 FROM public.settings
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read activities" ON public.activities;
CREATE POLICY "Authenticated users can read activities"
  ON public.activities
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert activities" ON public.activities;
CREATE POLICY "Authenticated users can insert activities"
  ON public.activities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_feature_permission('add'));

DROP POLICY IF EXISTS "Authenticated users can update activities" ON public.activities;
CREATE POLICY "Authenticated users can update activities"
  ON public.activities
  FOR UPDATE
  TO authenticated
  USING (public.has_feature_permission('edit_action'))
  WITH CHECK (public.has_feature_permission('edit_action'));

DROP POLICY IF EXISTS "Authenticated users can delete activities" ON public.activities;
CREATE POLICY "Authenticated users can delete activities"
  ON public.activities
  FOR DELETE
  TO authenticated
  USING (public.has_feature_permission('delete_action'));

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.users;
CREATE POLICY "Authenticated users can read profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
CREATE POLICY "Admins can insert users"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update users" ON public.users;
CREATE POLICY "Admins can update users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
CREATE POLICY "Admins can delete users"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.settings;
CREATE POLICY "Authenticated users can read settings"
  ON public.settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert settings" ON public.settings;
CREATE POLICY "Admins can insert settings"
  ON public.settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update settings" ON public.settings;
CREATE POLICY "Admins can update settings"
  ON public.settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete settings" ON public.settings;
CREATE POLICY "Admins can delete settings"
  ON public.settings
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-photos', 'user-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can read user photos" ON storage.objects;
CREATE POLICY "Authenticated users can read user photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'user-photos');

DROP POLICY IF EXISTS "Users can upload own user photo files" ON storage.objects;
CREATE POLICY "Users can upload own user photo files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own user photo files" ON storage.objects;
CREATE POLICY "Users can update own user photo files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own user photo files" ON storage.objects;
CREATE POLICY "Users can delete own user photo files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users can read branding assets" ON storage.objects;
CREATE POLICY "Authenticated users can read branding assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'branding-assets');

DROP POLICY IF EXISTS "Admins can upload branding assets" ON storage.objects;
CREATE POLICY "Admins can upload branding assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'branding-assets'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can update branding assets" ON storage.objects;
CREATE POLICY "Admins can update branding assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'branding-assets'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'branding-assets'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can delete branding assets" ON storage.objects;
CREATE POLICY "Admins can delete branding assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'branding-assets'
    AND public.is_admin()
  );
