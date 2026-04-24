-- ============================================
-- MIGRATION: Rename instrument to tag and allow empty date imports
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activities'
      AND column_name = 'instrument'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activities'
      AND column_name = 'tag'
  ) THEN
    ALTER TABLE public.activities RENAME COLUMN instrument TO tag;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activities'
      AND column_name = 'tag'
  ) THEN
    ALTER TABLE public.activities ADD COLUMN tag TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

ALTER TABLE public.activities
  ALTER COLUMN date TYPE TEXT USING COALESCE(date::text, ''),
  ALTER COLUMN date SET DEFAULT '',
  ALTER COLUMN date SET NOT NULL;

ALTER TABLE public.activities
  ALTER COLUMN tag SET DEFAULT '',
  ALTER COLUMN tag SET NOT NULL;

DROP INDEX IF EXISTS idx_activities_instrument;
CREATE INDEX IF NOT EXISTS idx_activities_tag ON public.activities(tag);
