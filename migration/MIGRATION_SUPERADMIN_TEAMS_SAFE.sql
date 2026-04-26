-- ============================================
-- MIGRATION: Safe superadmin + team isolation layer
-- ============================================
-- This migration is intentionally additive for legacy data. It does not alter,
-- update, or delete rows from the existing Automation tables:
--   public.activities, public.users, public.settings
--
-- Automation is copied into the unified team tables and then uses the same
-- team-scoped activity/settings paths as Process and Instrumentation.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.app_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  uses_legacy_tables BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.team_memberships (
  team_id UUID NOT NULL REFERENCES public.app_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  permissions JSONB NOT NULL DEFAULT '{"dashboard": true, "add": false, "edit": false, "search": true, "import": false, "export": true, "edit_action": false, "delete_action": false}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (team_id, user_id)
);

ALTER TABLE public.team_memberships
  ADD COLUMN IF NOT EXISTS team_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_name TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.team_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.app_teams(id) ON DELETE CASCADE,
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
  "editedBy" TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_activities'
      AND column_name = 'editedby'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_activities'
      AND column_name = 'editedBy'
  ) THEN
    ALTER TABLE public.team_activities RENAME COLUMN editedby TO "editedBy";
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.team_settings (
  team_id UUID PRIMARY KEY REFERENCES public.app_teams(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_team_memberships_user ON public.team_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_team ON public.team_memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_date ON public.team_activities(team_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_created_at ON public.team_activities(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_performer ON public.team_activities(team_id, performer);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_tag ON public.team_activities(team_id, tag);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_system ON public.team_activities(team_id, system);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_shift ON public.team_activities(team_id, shift);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_permit_number ON public.team_activities(team_id, permit_number);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_instrument_type ON public.team_activities(team_id, instrument_type);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_activity_type ON public.team_activities(team_id, "activityType");

CREATE OR REPLACE FUNCTION public.set_team_membership_labels()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT name
  INTO NEW.team_name
  FROM public.app_teams
  WHERE id = NEW.team_id;

  SELECT name
  INTO NEW.user_name
  FROM public.users
  WHERE id = NEW.user_id;

  NEW.team_name = COALESCE(NEW.team_name, '');
  NEW.user_name = COALESCE(NEW.user_name, '');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_team_membership_labels_before_write ON public.team_memberships;
CREATE TRIGGER set_team_membership_labels_before_write
BEFORE INSERT OR UPDATE OF team_id, user_id
ON public.team_memberships
FOR EACH ROW
EXECUTE FUNCTION public.set_team_membership_labels();

CREATE OR REPLACE FUNCTION public.refresh_team_membership_team_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.team_memberships
  SET team_name = NEW.name
  WHERE team_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_team_membership_team_name_after_update ON public.app_teams;
CREATE TRIGGER refresh_team_membership_team_name_after_update
AFTER UPDATE OF name
ON public.app_teams
FOR EACH ROW
EXECUTE FUNCTION public.refresh_team_membership_team_name();

CREATE OR REPLACE FUNCTION public.refresh_team_membership_user_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.team_memberships
  SET user_name = NEW.name
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_team_membership_user_name_after_update ON public.users;
CREATE TRIGGER refresh_team_membership_user_name_after_update
AFTER UPDATE OF name
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.refresh_team_membership_user_name();

INSERT INTO public.app_teams (name, slug, uses_legacy_tables)
VALUES ('Automation', 'automation', false)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  uses_legacy_tables = false,
  is_active = true;

INSERT INTO public.app_teams (name, slug, uses_legacy_tables)
VALUES
  ('Process', 'process', false),
  ('Instrumentation', 'instrumentation', false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.team_settings (team_id, webapp_name, browser_tab_name, primary_color, performer_mode)
SELECT
  id,
  CASE
    WHEN slug = 'automation' THEN 'Daily Activities Tracker'
    ELSE name || ' Activities Tracker'
  END,
  CASE
    WHEN slug = 'automation' THEN 'Daily Activities Tracker'
    ELSE name || ' Activities'
  END,
  '#667eea',
  'manual'
FROM public.app_teams
ON CONFLICT (team_id) DO NOTHING;

-- Copy the existing Automation settings into the unified Automation team
-- settings row. Legacy settings rows remain untouched.
INSERT INTO public.team_settings (
  team_id,
  webapp_name,
  logo_url,
  browser_tab_name,
  favicon_url,
  primary_color,
  performer_mode,
  header_font_family,
  header_font_size,
  subheader_font_family,
  subheader_font_size,
  sidebar_font_family,
  sidebar_font_size,
  updated_at,
  updated_by
)
SELECT
  automation_team.id,
  COALESCE(legacy_settings.webapp_name, 'Daily Activities Tracker'),
  COALESCE(legacy_settings.logo_url, ''),
  COALESCE(legacy_settings.browser_tab_name, legacy_settings.webapp_name, 'Daily Activities Tracker'),
  COALESCE(legacy_settings.favicon_url, legacy_settings.logo_url, ''),
  COALESCE(legacy_settings.primary_color, '#667eea'),
  COALESCE(legacy_settings.performer_mode, 'manual'),
  COALESCE(legacy_settings.header_font_family, ''),
  COALESCE(legacy_settings.header_font_size, '2.5rem'),
  COALESCE(legacy_settings.subheader_font_family, ''),
  COALESCE(legacy_settings.subheader_font_size, '1.5rem'),
  COALESCE(legacy_settings.sidebar_font_family, ''),
  COALESCE(legacy_settings.sidebar_font_size, '0.95rem'),
  COALESCE(legacy_settings.updated_at, timezone('utc', now())),
  legacy_settings.updated_by
FROM (
  SELECT id
  FROM public.app_teams
  WHERE slug = 'automation'
  LIMIT 1
) automation_team
LEFT JOIN LATERAL (
  SELECT *
  FROM public.settings
  ORDER BY updated_at DESC NULLS LAST, id DESC
  LIMIT 1
) legacy_settings ON true
ON CONFLICT (team_id) DO UPDATE
SET
  webapp_name = EXCLUDED.webapp_name,
  logo_url = EXCLUDED.logo_url,
  browser_tab_name = EXCLUDED.browser_tab_name,
  favicon_url = EXCLUDED.favicon_url,
  primary_color = EXCLUDED.primary_color,
  performer_mode = EXCLUDED.performer_mode,
  header_font_family = EXCLUDED.header_font_family,
  header_font_size = EXCLUDED.header_font_size,
  subheader_font_family = EXCLUDED.subheader_font_family,
  subheader_font_size = EXCLUDED.subheader_font_size,
  sidebar_font_family = EXCLUDED.sidebar_font_family,
  sidebar_font_size = EXCLUDED.sidebar_font_size,
  updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by
WHERE public.team_settings.updated_by IS NULL;

-- Register every existing profile as a member of the Automation team and
-- copy the existing global roles into Automation team roles.
INSERT INTO public.team_memberships (team_id, user_id, role, permissions, is_default)
SELECT
  automation_team.id,
  app_user.id,
  CASE
    WHEN app_user.role IN ('admin', 'editor', 'viewer') THEN app_user.role
    ELSE 'viewer'
  END,
  COALESCE(
    app_user.permissions,
    CASE
      WHEN app_user.role = 'admin' THEN '{"dashboard": true, "add": true, "edit": true, "search": true, "import": true, "export": true, "edit_action": true, "delete_action": true}'::jsonb
      WHEN app_user.role = 'editor' THEN '{"dashboard": true, "add": true, "edit": true, "search": true, "import": true, "export": true, "edit_action": true, "delete_action": true}'::jsonb
      ELSE '{"dashboard": true, "add": false, "edit": false, "search": true, "import": false, "export": true, "edit_action": false, "delete_action": false}'::jsonb
    END
  ),
  true
FROM public.users app_user
CROSS JOIN (
  SELECT id
  FROM public.app_teams
  WHERE slug = 'automation'
  LIMIT 1
) automation_team
ON CONFLICT (team_id, user_id) DO UPDATE
SET
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  is_default = true;

UPDATE public.team_memberships membership
SET
  team_name = app_team.name,
  user_name = app_user.name
FROM public.app_teams app_team, public.users app_user
WHERE membership.team_id = app_team.id
  AND membership.user_id = app_user.id;

-- Copy existing Automation activities into unified team_activities. The old
-- public.activities rows are kept in place.
INSERT INTO public.team_activities (
  id,
  team_id,
  date,
  performer,
  system,
  "activityType",
  tag,
  problem,
  action,
  comments,
  "editedBy",
  created_at
)
SELECT
  legacy_activity.id,
  automation_team.id,
  COALESCE(legacy_activity.date, ''),
  legacy_activity.performer,
  COALESCE(legacy_activity.system, ''),
  COALESCE(legacy_activity."activityType", ''),
  COALESCE(legacy_activity.tag, ''),
  legacy_activity.problem,
  legacy_activity.action,
  COALESCE(legacy_activity.comments, ''),
  legacy_activity."editedBy",
  COALESCE(legacy_activity.created_at, timezone('utc', now()))
FROM public.activities legacy_activity
CROSS JOIN (
  SELECT id
  FROM public.app_teams
  WHERE slug = 'automation'
  LIMIT 1
) automation_team
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.has_feature_permission(feature_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_superadmin() THEN TRUE
    ELSE COALESCE(
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
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_team_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.team_memberships
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_access_team(target_team_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.team_memberships
      WHERE team_id = target_team_id
        AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.team_role(target_team_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_superadmin() THEN 'admin'
    ELSE COALESCE(
      (
        SELECT role
        FROM public.team_memberships
        WHERE team_id = target_team_id
          AND user_id = auth.uid()
        LIMIT 1
      ),
      'viewer'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_team_feature_permission(target_team_id UUID, feature_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_superadmin() THEN TRUE
    ELSE COALESCE(
      (
        SELECT
          CASE
            WHEN role = 'admin' THEN TRUE
            ELSE COALESCE((permissions ->> feature_name)::boolean, FALSE)
          END
        FROM public.team_memberships
        WHERE team_id = target_team_id
          AND user_id = auth.uid()
        LIMIT 1
      ),
      FALSE
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_default_automation_membership(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  automation_team_id UUID;
  profile_role TEXT;
  profile_permissions JSONB;
BEGIN
  SELECT id INTO automation_team_id
  FROM public.app_teams
  WHERE slug = 'automation'
  LIMIT 1;

  IF automation_team_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    CASE
      WHEN role IN ('admin', 'editor', 'viewer') THEN role
      ELSE 'viewer'
    END,
    COALESCE(
      permissions,
      CASE
        WHEN role = 'admin' THEN '{"dashboard": true, "add": true, "edit": true, "search": true, "import": true, "export": true, "edit_action": true, "delete_action": true}'::jsonb
        WHEN role = 'editor' THEN '{"dashboard": true, "add": true, "edit": true, "search": true, "import": true, "export": true, "edit_action": true, "delete_action": true}'::jsonb
        ELSE '{"dashboard": true, "add": false, "edit": false, "search": true, "import": false, "export": true, "edit_action": false, "delete_action": false}'::jsonb
      END
    )
  INTO profile_role, profile_permissions
  FROM public.users
  WHERE id = target_user_id;

  IF profile_role IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.team_memberships (team_id, user_id, role, permissions, is_default)
  VALUES (automation_team_id, target_user_id, profile_role, profile_permissions, true)
  ON CONFLICT (team_id, user_id) DO NOTHING;
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

  PERFORM public.ensure_default_automation_membership(NEW.id);

  RETURN NEW;
END;
$$;

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins can read superadmin registry" ON public.super_admins;
CREATE POLICY "Superadmins can read superadmin registry"
  ON public.super_admins
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Superadmins can manage superadmin registry" ON public.super_admins;
CREATE POLICY "Superadmins can manage superadmin registry"
  ON public.super_admins
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Members can read their teams" ON public.app_teams;
CREATE POLICY "Members can read their teams"
  ON public.app_teams
  FOR SELECT
  TO authenticated
  USING (public.can_access_team(id));

DROP POLICY IF EXISTS "Superadmins can manage teams" ON public.app_teams;
CREATE POLICY "Superadmins can manage teams"
  ON public.app_teams
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Users can read own team memberships" ON public.team_memberships;
CREATE POLICY "Users can read own team memberships"
  ON public.team_memberships
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin() OR user_id = auth.uid() OR public.can_access_team(team_id));

DROP POLICY IF EXISTS "Superadmins can manage team memberships" ON public.team_memberships;
CREATE POLICY "Superadmins can manage team memberships"
  ON public.team_memberships
  FOR ALL
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Team members can read isolated activities" ON public.team_activities;
CREATE POLICY "Team members can read isolated activities"
  ON public.team_activities
  FOR SELECT
  TO authenticated
  USING (public.has_team_feature_permission(team_id, 'dashboard') OR public.has_team_feature_permission(team_id, 'search'));

DROP POLICY IF EXISTS "Team members can insert isolated activities" ON public.team_activities;
CREATE POLICY "Team members can insert isolated activities"
  ON public.team_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_team_feature_permission(team_id, 'add'));

DROP POLICY IF EXISTS "Team members can update isolated activities" ON public.team_activities;
CREATE POLICY "Team members can update isolated activities"
  ON public.team_activities
  FOR UPDATE
  TO authenticated
  USING (public.has_team_feature_permission(team_id, 'edit_action'))
  WITH CHECK (public.has_team_feature_permission(team_id, 'edit_action'));

DROP POLICY IF EXISTS "Team members can delete isolated activities" ON public.team_activities;
CREATE POLICY "Team members can delete isolated activities"
  ON public.team_activities
  FOR DELETE
  TO authenticated
  USING (public.has_team_feature_permission(team_id, 'delete_action'));

DROP POLICY IF EXISTS "Team members can read team settings" ON public.team_settings;
CREATE POLICY "Team members can read team settings"
  ON public.team_settings
  FOR SELECT
  TO authenticated
  USING (public.can_access_team(team_id));

DROP POLICY IF EXISTS "Team admins can write team settings" ON public.team_settings;
CREATE POLICY "Team admins can write team settings"
  ON public.team_settings
  FOR ALL
  TO authenticated
  USING (public.is_superadmin() OR public.team_role(team_id) = 'admin')
  WITH CHECK (public.is_superadmin() OR public.team_role(team_id) = 'admin');

DROP POLICY IF EXISTS "Superadmins can read all profiles" ON public.users;
CREATE POLICY "Superadmins can read all profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin());

DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

DROP POLICY IF EXISTS "Superadmins can insert all profiles" ON public.users;
CREATE POLICY "Superadmins can insert all profiles"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmins can update all profiles" ON public.users;
CREATE POLICY "Superadmins can update all profiles"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmins can delete all profiles" ON public.users;
CREATE POLICY "Superadmins can delete all profiles"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only Super Admin users can delete accounts.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account.';
  END IF;

  DELETE FROM auth.users
  WHERE id = target_user_id;
END;
$$;

COMMIT;
