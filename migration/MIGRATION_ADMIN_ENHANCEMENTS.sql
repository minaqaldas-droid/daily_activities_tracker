-- ============================================
-- Admin Enhancements Migration
-- ============================================

-- 1) Normalize roles: superadmin -> admin
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE public.users
SET role = 'admin'
WHERE role = 'superadmin';

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_primary_color TEXT NOT NULL DEFAULT '';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{"dashboard": true, "add": false, "edit": false, "search": true, "import": false, "export": true, "edit_action": false, "delete_action": false}'::jsonb;

UPDATE public.users
SET permissions = '{"dashboard": true, "add": true, "edit": true, "search": true, "import": true, "export": true, "edit_action": true, "delete_action": true}'::jsonb
WHERE role = 'admin';

-- 2) Admin helper function (keeps backward compatibility with old role values)
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
      AND role IN ('admin', 'superadmin')
  );
$$;

-- Keep legacy function name in case any older logic still calls it.
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin();
$$;

-- 3) Settings extensions: browser tab branding + typography
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS browser_tab_name TEXT NOT NULL DEFAULT 'Daily Activities Tracker',
  ADD COLUMN IF NOT EXISTS favicon_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS header_font_family TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS header_font_size TEXT NOT NULL DEFAULT '2.5rem',
  ADD COLUMN IF NOT EXISTS subheader_font_family TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subheader_font_size TEXT NOT NULL DEFAULT '1.5rem',
  ADD COLUMN IF NOT EXISTS sidebar_font_family TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sidebar_font_size TEXT NOT NULL DEFAULT '0.95rem';

-- 4) Allow admins to manage users (CRUD in admin panel)
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

-- 5) Rename settings policies to Admin wording and use is_admin()
DROP POLICY IF EXISTS "Superadmins can insert settings" ON public.settings;
DROP POLICY IF EXISTS "Superadmins can update settings" ON public.settings;
DROP POLICY IF EXISTS "Superadmins can delete settings" ON public.settings;

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

-- 6) User photos storage bucket + policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-photos', 'user-photos', true)
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

-- 7) Branding assets bucket (logo + favicon uploads from admin panel)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true)
ON CONFLICT (id) DO NOTHING;

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
