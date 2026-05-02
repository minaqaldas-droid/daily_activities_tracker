BEGIN;

CREATE INDEX IF NOT EXISTS idx_team_activities_team_date_created_compound
  ON public.team_activities(team_id, date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_activities_team_edited_present
  ON public.team_activities(team_id, edited_at DESC)
  WHERE edited_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_activities_team_performer_exact
  ON public.team_activities(team_id, performer);

CREATE INDEX IF NOT EXISTS idx_team_activities_team_system_exact
  ON public.team_activities(team_id, system);

CREATE INDEX IF NOT EXISTS idx_team_activities_team_shift_exact
  ON public.team_activities(team_id, shift);

CREATE INDEX IF NOT EXISTS idx_team_activities_team_tag_exact
  ON public.team_activities(team_id, tag);

CREATE INDEX IF NOT EXISTS idx_team_activities_team_activity_type_exact
  ON public.team_activities(team_id, "activityType");

CREATE INDEX IF NOT EXISTS idx_team_activities_team_instrument_type_exact
  ON public.team_activities(team_id, instrument_type);

COMMIT;
