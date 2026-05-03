BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_team_activities_team_recent_compound
  ON public.team_activities(team_id, date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_activities_team_edited_recent
  ON public.team_activities(team_id, edited_at DESC, created_at DESC)
  WHERE edited_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_activities_custom_fields_gin
  ON public.team_activities USING gin (custom_fields);

CREATE INDEX IF NOT EXISTS idx_team_settings_team_id
  ON public.team_settings(team_id);

CREATE INDEX IF NOT EXISTS idx_team_memberships_team_user
  ON public.team_memberships(team_id, user_id);

CREATE INDEX IF NOT EXISTS idx_team_memberships_user_team
  ON public.team_memberships(user_id, team_id);

CREATE INDEX IF NOT EXISTS idx_team_activities_performer_trgm
  ON public.team_activities USING gin (performer gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_team_activities_tag_trgm
  ON public.team_activities USING gin (tag gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_team_activities_permit_number_trgm
  ON public.team_activities USING gin (permit_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_team_activities_instrument_type_trgm
  ON public.team_activities USING gin (instrument_type gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_team_activities_problem_trgm
  ON public.team_activities USING gin (problem gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_team_activities_action_trgm
  ON public.team_activities USING gin (action gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_team_activities_comments_trgm
  ON public.team_activities USING gin (comments gin_trgm_ops);

COMMIT;
