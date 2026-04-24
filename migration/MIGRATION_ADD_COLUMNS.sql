-- ============================================
-- MIGRATION: Align activities table with current app schema
-- ============================================

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS system TEXT NOT NULL DEFAULT '';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS "activityType" TEXT NOT NULL DEFAULT '';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT '';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS comments TEXT NOT NULL DEFAULT '';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS editedBy TEXT;

CREATE INDEX IF NOT EXISTS idx_activities_system ON public.activities(system);
CREATE INDEX IF NOT EXISTS idx_activities_tag ON public.activities(tag);
CREATE INDEX IF NOT EXISTS idx_activities_activity_type ON public.activities("activityType");

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activities'
ORDER BY ordinal_position;
