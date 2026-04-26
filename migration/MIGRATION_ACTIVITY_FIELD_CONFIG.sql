ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS shift TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS permit_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instrument_type TEXT NOT NULL DEFAULT '';

ALTER TABLE public.team_activities
  ADD COLUMN IF NOT EXISTS shift TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS permit_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instrument_type TEXT NOT NULL DEFAULT '';

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS activity_field_config JSONB NOT NULL DEFAULT '{
    "date": { "enabled": true, "required": true, "order": 10 },
    "performer": { "enabled": true, "required": true, "order": 20 },
    "system": { "enabled": true, "required": true, "order": 30 },
    "shift": { "enabled": false, "required": false, "order": 40 },
    "permitNumber": { "enabled": false, "required": false, "order": 50 },
    "instrumentType": { "enabled": false, "required": false, "order": 60 },
    "activityType": { "enabled": true, "required": true, "order": 70 },
    "tag": { "enabled": true, "required": true, "order": 80 },
    "problem": { "enabled": true, "required": true, "order": 90 },
    "action": { "enabled": true, "required": true, "order": 100 },
    "comments": { "enabled": true, "required": false, "order": 110 }
  }'::jsonb;

ALTER TABLE public.team_settings
  ADD COLUMN IF NOT EXISTS activity_field_config JSONB NOT NULL DEFAULT '{
    "date": { "enabled": true, "required": true, "order": 10 },
    "performer": { "enabled": true, "required": true, "order": 20 },
    "system": { "enabled": true, "required": true, "order": 30 },
    "shift": { "enabled": false, "required": false, "order": 40 },
    "permitNumber": { "enabled": false, "required": false, "order": 50 },
    "instrumentType": { "enabled": false, "required": false, "order": 60 },
    "activityType": { "enabled": true, "required": true, "order": 70 },
    "tag": { "enabled": true, "required": true, "order": 80 },
    "problem": { "enabled": true, "required": true, "order": 90 },
    "action": { "enabled": true, "required": true, "order": 100 },
    "comments": { "enabled": true, "required": false, "order": 110 }
  }'::jsonb;

UPDATE public.settings
SET activity_field_config = jsonb_build_object(
  'date', jsonb_build_object('enabled', true, 'required', true, 'order', 10),
  'performer', jsonb_build_object('enabled', true, 'required', true, 'order', 20),
  'system', jsonb_build_object('enabled', true, 'required', true, 'order', 30),
  'shift', jsonb_build_object(
    'enabled', COALESCE((activity_field_config -> 'shift' ->> 'enabled')::boolean, false),
    'required', COALESCE((activity_field_config -> 'shift' ->> 'required')::boolean, false),
    'order', COALESCE((activity_field_config -> 'shift' ->> 'order')::integer, 40)
  ),
  'permitNumber', jsonb_build_object(
    'enabled', COALESCE((activity_field_config -> 'permitNumber' ->> 'enabled')::boolean, false),
    'required', COALESCE((activity_field_config -> 'permitNumber' ->> 'required')::boolean, false),
    'order', COALESCE((activity_field_config -> 'permitNumber' ->> 'order')::integer, 50)
  ),
  'instrumentType', jsonb_build_object(
    'enabled', COALESCE((activity_field_config -> 'instrumentType' ->> 'enabled')::boolean, false),
    'required', COALESCE((activity_field_config -> 'instrumentType' ->> 'required')::boolean, false),
    'order', COALESCE((activity_field_config -> 'instrumentType' ->> 'order')::integer, 60)
  ),
  'activityType', jsonb_build_object('enabled', true, 'required', true, 'order', 70),
  'tag', jsonb_build_object('enabled', true, 'required', true, 'order', 80),
  'problem', jsonb_build_object('enabled', true, 'required', true, 'order', 90),
  'action', jsonb_build_object('enabled', true, 'required', true, 'order', 100),
  'comments', jsonb_build_object('enabled', true, 'required', false, 'order', 110)
);

UPDATE public.team_settings
SET activity_field_config = jsonb_build_object(
  'date', jsonb_build_object('enabled', true, 'required', true, 'order', 10),
  'performer', jsonb_build_object('enabled', true, 'required', true, 'order', 20),
  'system', jsonb_build_object('enabled', true, 'required', true, 'order', 30),
  'shift', jsonb_build_object(
    'enabled', COALESCE((activity_field_config -> 'shift' ->> 'enabled')::boolean, false),
    'required', COALESCE((activity_field_config -> 'shift' ->> 'required')::boolean, false),
    'order', COALESCE((activity_field_config -> 'shift' ->> 'order')::integer, 40)
  ),
  'permitNumber', jsonb_build_object(
    'enabled', COALESCE((activity_field_config -> 'permitNumber' ->> 'enabled')::boolean, false),
    'required', COALESCE((activity_field_config -> 'permitNumber' ->> 'required')::boolean, false),
    'order', COALESCE((activity_field_config -> 'permitNumber' ->> 'order')::integer, 50)
  ),
  'instrumentType', jsonb_build_object(
    'enabled', COALESCE((activity_field_config -> 'instrumentType' ->> 'enabled')::boolean, false),
    'required', COALESCE((activity_field_config -> 'instrumentType' ->> 'required')::boolean, false),
    'order', COALESCE((activity_field_config -> 'instrumentType' ->> 'order')::integer, 60)
  ),
  'activityType', jsonb_build_object('enabled', true, 'required', true, 'order', 70),
  'tag', jsonb_build_object('enabled', true, 'required', true, 'order', 80),
  'problem', jsonb_build_object('enabled', true, 'required', true, 'order', 90),
  'action', jsonb_build_object('enabled', true, 'required', true, 'order', 100),
  'comments', jsonb_build_object('enabled', true, 'required', false, 'order', 110)
);

CREATE INDEX IF NOT EXISTS idx_activities_shift ON public.activities(shift);
CREATE INDEX IF NOT EXISTS idx_activities_permit_number ON public.activities(permit_number);
CREATE INDEX IF NOT EXISTS idx_activities_instrument_type ON public.activities(instrument_type);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_shift ON public.team_activities(team_id, shift);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_permit_number ON public.team_activities(team_id, permit_number);
CREATE INDEX IF NOT EXISTS idx_team_activities_team_instrument_type ON public.team_activities(team_id, instrument_type);
