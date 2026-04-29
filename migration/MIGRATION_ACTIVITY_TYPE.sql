-- ============================================
-- MIGRATION: Add activity type support
-- ============================================

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS "activityType" TEXT NOT NULL DEFAULT '';

UPDATE public.activities
SET "activityType" = ''
WHERE "activityType" IS NULL;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class relation ON relation.oid = con.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_attribute attribute ON attribute.attrelid = relation.oid
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'activities'
      AND attribute.attname = 'activityType'
      AND attribute.attnum = ANY (con.conkey)
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.activities DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  ALTER TABLE public.activities
    ADD CONSTRAINT activities_activitytype_check
    CHECK ("activityType" IN ('', 'PM', 'CM', 'Mod', 'SD Activity'));
END $$;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  IF to_regclass('public.team_activities') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.team_activities
    ADD COLUMN IF NOT EXISTS "activityType" TEXT NOT NULL DEFAULT '';

  UPDATE public.team_activities
  SET "activityType" = ''
  WHERE "activityType" IS NULL;

  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class relation ON relation.oid = con.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_attribute attribute ON attribute.attrelid = relation.oid
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'team_activities'
      AND attribute.attname = 'activityType'
      AND attribute.attnum = ANY (con.conkey)
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.team_activities DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  ALTER TABLE public.team_activities
    ADD CONSTRAINT team_activities_activitytype_check
    CHECK ("activityType" IN ('', 'PM', 'CM', 'Mod', 'SD Activity'));
END $$;

CREATE INDEX IF NOT EXISTS idx_activities_activity_type ON public.activities("activityType");

DO $$
BEGIN
  IF to_regclass('public.team_activities') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_team_activities_team_activity_type ON public.team_activities(team_id, "activityType")';
  END IF;
END $$;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activities'
ORDER BY ordinal_position;
