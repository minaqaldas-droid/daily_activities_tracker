-- ============================================
-- MIGRATION: Activity audit fields + last sign in
-- ============================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

ALTER TABLE public.team_activities
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_last_sign_in_at
  ON public.users(last_sign_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_edited_at
  ON public.activities(edited_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_activities_team_edited_at
  ON public.team_activities(team_id, edited_at DESC);

COMMIT;
