-- ============================================
-- MIGRATION: Add performer_mode column to settings
-- ============================================

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS performer_mode TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_performer_mode_check;
ALTER TABLE public.settings
  ADD CONSTRAINT settings_performer_mode_check
  CHECK (performer_mode IN ('manual', 'auto'));

UPDATE public.settings
SET performer_mode = 'manual'
WHERE performer_mode IS NULL;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'settings'
  AND column_name = 'performer_mode';
