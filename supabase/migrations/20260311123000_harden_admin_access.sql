-- Lock down admin-only database surfaces that should not be directly readable
-- by any authenticated user.

-- admin_profile_stats is now served through an admin-only Edge Function.
REVOKE ALL ON public.admin_profile_stats FROM authenticated;
REVOKE ALL ON public.admin_profile_stats FROM anon;
GRANT SELECT ON public.admin_profile_stats TO service_role;

-- matching_rules should only be editable/readable by admins and service role.
DROP POLICY IF EXISTS "Allow read access to anyone" ON public.matching_rules;
DROP POLICY IF EXISTS "Admins can read matching rules" ON public.matching_rules;
DROP POLICY IF EXISTS "Admins can insert matching rules" ON public.matching_rules;
DROP POLICY IF EXISTS "Admins can update matching rules" ON public.matching_rules;
DROP POLICY IF EXISTS "Admins can delete matching rules" ON public.matching_rules;

CREATE POLICY "Admins can read matching rules"
ON public.matching_rules
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can insert matching rules"
ON public.matching_rules
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can update matching rules"
ON public.matching_rules
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can delete matching rules"
ON public.matching_rules
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);
