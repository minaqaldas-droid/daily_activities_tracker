-- Daily team activity email summaries
-- Run this in Supabase SQL Editor before deploying the Edge Function.

ALTER TABLE public.team_settings
  ADD COLUMN IF NOT EXISTS daily_activity_email_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.team_settings
  ADD COLUMN IF NOT EXISTS daily_activity_email_time TEXT NOT NULL DEFAULT '17:00';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'team_settings_daily_activity_email_time_check'
  ) THEN
    ALTER TABLE public.team_settings
      ADD CONSTRAINT team_settings_daily_activity_email_time_check
      CHECK (daily_activity_email_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.daily_activity_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.app_teams(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  activity_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_activity_email_logs_team_summary_sent_idx
  ON public.daily_activity_email_logs(team_id, summary_date)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS idx_daily_activity_email_logs_team_date
  ON public.daily_activity_email_logs(team_id, summary_date DESC, created_at DESC);

ALTER TABLE public.daily_activity_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team admins can read daily email logs" ON public.daily_activity_email_logs;
CREATE POLICY "Team admins can read daily email logs"
  ON public.daily_activity_email_logs
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.team_memberships membership
      WHERE membership.team_id = daily_activity_email_logs.team_id
        AND membership.user_id = auth.uid()
        AND membership.role = 'admin'
    )
  );
