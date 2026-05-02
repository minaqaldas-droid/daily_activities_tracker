BEGIN;

ALTER TABLE public.team_activities
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.team_settings
  ADD COLUMN IF NOT EXISTS activity_field_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dashboard_chart_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dashboard_card_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dashboard_card_config JSONB NOT NULL DEFAULT '{
    "totalActivities": { "enabled": true, "order": 1 },
    "myActivities": { "enabled": true, "order": 2 },
    "thisWeekActivities": { "enabled": true, "order": 3 },
    "recentlyEdited": { "enabled": true, "order": 4 }
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS layout_config JSONB NOT NULL DEFAULT '{
    "activityFormColumns": { "mobile": 1, "tablet": 2, "desktop": 3 },
    "searchFilterColumns": { "mobile": 1, "tablet": 2, "desktop": 3 },
    "dashboardChartColumns": { "mobile": 1, "tablet": 2, "desktop": 3 }
  }'::jsonb;

UPDATE public.team_settings
SET
  activity_field_definitions = COALESCE(activity_field_definitions, '[]'::jsonb),
  dashboard_chart_definitions = COALESCE(dashboard_chart_definitions, '[]'::jsonb),
  dashboard_card_definitions = COALESCE(dashboard_card_definitions, '[]'::jsonb),
  dashboard_card_config = COALESCE(
    dashboard_card_config,
    '{
      "totalActivities": { "enabled": true, "order": 1 },
      "myActivities": { "enabled": true, "order": 2 },
      "thisWeekActivities": { "enabled": true, "order": 3 },
      "recentlyEdited": { "enabled": true, "order": 4 }
    }'::jsonb
  ),
  layout_config = COALESCE(
    layout_config,
    '{
      "activityFormColumns": { "mobile": 1, "tablet": 2, "desktop": 3 },
      "searchFilterColumns": { "mobile": 1, "tablet": 2, "desktop": 3 },
      "dashboardChartColumns": { "mobile": 1, "tablet": 2, "desktop": 3 }
    }'::jsonb
  );

COMMIT;
