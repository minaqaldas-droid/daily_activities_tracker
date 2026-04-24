-- ============================================
-- MIGRATION: Add activity type support
-- ============================================

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS "activityType" TEXT NOT NULL DEFAULT '';

UPDATE public.activities
SET "activityType" = ''
WHERE "activityType" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activities_activitytype_check'
      AND conrelid = 'public.activities'::regclass
  ) THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_activitytype_check
      CHECK ("activityType" IN ('', 'PM', 'CM', 'Mod'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activities_activity_type ON public.activities("activityType");

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activities'
ORDER BY ordinal_position;
