-- ============================================
-- MIGRATION: Enforce activity RLS by user permissions
-- ============================================

BEGIN;

-- Helper: check current user's feature permission.
CREATE OR REPLACE FUNCTION public.has_feature_permission(feature_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT
        CASE
          WHEN role = 'admin' THEN TRUE
          ELSE COALESCE((permissions ->> feature_name)::boolean, FALSE)
        END
      FROM public.users
      WHERE id = auth.uid()
      LIMIT 1
    ),
    FALSE
  );
$$;

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read activities" ON public.activities;
CREATE POLICY "Authenticated users can read activities"
  ON public.activities
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert activities" ON public.activities;
CREATE POLICY "Authenticated users can insert activities"
  ON public.activities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_feature_permission('add'));

DROP POLICY IF EXISTS "Authenticated users can update activities" ON public.activities;
CREATE POLICY "Authenticated users can update activities"
  ON public.activities
  FOR UPDATE
  TO authenticated
  USING (public.has_feature_permission('edit_action'))
  WITH CHECK (public.has_feature_permission('edit_action'));

DROP POLICY IF EXISTS "Authenticated users can delete activities" ON public.activities;
CREATE POLICY "Authenticated users can delete activities"
  ON public.activities
  FOR DELETE
  TO authenticated
  USING (public.has_feature_permission('delete_action'));

COMMIT;
