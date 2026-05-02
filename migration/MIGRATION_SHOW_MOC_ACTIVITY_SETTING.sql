BEGIN;

ALTER TABLE public.team_settings
  ADD COLUMN IF NOT EXISTS show_moc_activity BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.team_settings
SET show_moc_activity = COALESCE(show_moc_activity, TRUE);

COMMIT;
