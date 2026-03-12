-- Live Supabase policy audit
-- Run this in the Supabase SQL editor against the deployed project.
--
-- This script is read-only. It does not change schema or data.
-- It helps answer:
-- - Which public tables/views have RLS enabled?
-- - What policies are actually live right now?
-- - What can anon/authenticated/service_role do at the SQL permission layer?
-- - Are the high-risk relations locked down as expected?

-- ============================================================
-- 1. Public schema relation inventory
-- ============================================================
WITH public_relations AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS relation_name,
    CASE c.relkind
      WHEN 'r' THEN 'table'
      WHEN 'p' THEN 'partitioned_table'
      WHEN 'v' THEN 'view'
      WHEN 'm' THEN 'materialized_view'
      ELSE c.relkind::text
    END AS relation_type,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    pg_get_userbyid(c.relowner) AS owner_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm')
)
SELECT *
FROM public_relations
ORDER BY relation_type, relation_name;

-- ============================================================
-- 2. Focused relation security summary
-- ============================================================
WITH focus_relations AS (
  SELECT *
  FROM (
    VALUES
      ('public', 'profiles'),
      ('public', 'private_profile_data'),
      ('public', 'matches'),
      ('public', 'likes'),
      ('public', 'dislikes'),
      ('public', 'dates'),
      ('public', 'matching_rules'),
      ('public', 'admin_profile_stats')
  ) AS t(schema_name, relation_name)
),
relation_meta AS (
  SELECT
    fr.schema_name,
    fr.relation_name,
    CASE c.relkind
      WHEN 'r' THEN 'table'
      WHEN 'p' THEN 'partitioned_table'
      WHEN 'v' THEN 'view'
      WHEN 'm' THEN 'materialized_view'
      ELSE c.relkind::text
    END AS relation_type,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
  FROM focus_relations fr
  LEFT JOIN pg_class c
    ON c.relname = fr.relation_name
   AND c.relnamespace = 'public'::regnamespace
),
role_matrix AS (
  SELECT unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
)
SELECT
  rm.schema_name,
  rm.relation_name,
  rm.relation_type,
  rm.rls_enabled,
  rm.rls_forced,
  r.role_name,
  has_table_privilege(r.role_name, format('%I.%I', rm.schema_name, rm.relation_name), 'SELECT') AS can_select,
  has_table_privilege(r.role_name, format('%I.%I', rm.schema_name, rm.relation_name), 'INSERT') AS can_insert,
  has_table_privilege(r.role_name, format('%I.%I', rm.schema_name, rm.relation_name), 'UPDATE') AS can_update,
  has_table_privilege(r.role_name, format('%I.%I', rm.schema_name, rm.relation_name), 'DELETE') AS can_delete
FROM relation_meta rm
CROSS JOIN role_matrix r
ORDER BY rm.relation_name, r.role_name;

-- ============================================================
-- 3. Live policies on the focus relations
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'private_profile_data',
    'matches',
    'likes',
    'dislikes',
    'dates',
    'matching_rules'
  )
ORDER BY tablename, policyname;

-- ============================================================
-- 4. Relation-level grants from information_schema
-- ============================================================
SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'private_profile_data',
    'matches',
    'likes',
    'dislikes',
    'dates',
    'matching_rules',
    'admin_profile_stats'
  )
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- ============================================================
-- 5. View definition for admin_profile_stats
-- ============================================================
SELECT
  'public.admin_profile_stats' AS relation_name,
  pg_get_viewdef('public.admin_profile_stats'::regclass, true) AS view_definition;

-- ============================================================
-- 6. Quick flags for likely problems
-- ============================================================
WITH public_relations AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS relation_name,
    CASE c.relkind
      WHEN 'r' THEN 'table'
      WHEN 'p' THEN 'partitioned_table'
      WHEN 'v' THEN 'view'
      WHEN 'm' THEN 'materialized_view'
      ELSE c.relkind::text
    END AS relation_type,
    c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm')
),
role_matrix AS (
  SELECT unnest(ARRAY['anon', 'authenticated']) AS role_name
)
SELECT
  pr.schema_name,
  pr.relation_name,
  pr.relation_type,
  pr.rls_enabled,
  rm.role_name,
  has_table_privilege(rm.role_name, format('%I.%I', pr.schema_name, pr.relation_name), 'SELECT') AS can_select
FROM public_relations pr
CROSS JOIN role_matrix rm
WHERE (
    pr.relation_type IN ('table', 'partitioned_table')
    AND pr.rls_enabled = false
    AND has_table_privilege(rm.role_name, format('%I.%I', pr.schema_name, pr.relation_name), 'SELECT')
  )
  OR (
    pr.relation_type IN ('view', 'materialized_view')
    AND has_table_privilege(rm.role_name, format('%I.%I', pr.schema_name, pr.relation_name), 'SELECT')
  )
ORDER BY pr.relation_name, rm.role_name;

-- ============================================================
-- 7. Optional smoke test template as a normal authenticated user
-- ============================================================
-- Replace both UUIDs below before running this block.
-- This block runs inside a transaction and rolls back at the end.
--
-- Expected high-signal checks:
-- - private_profile_data: own row visible, other row not visible
-- - admin_profile_stats: authenticated should not have SELECT privilege
--   because access is blocked at the grant level for this admin-only view
-- - matching_rules: authenticated should see 0 rows unless admin
--   because access is blocked by RLS
-- - dates: the user should see their own dates, but not unrelated dates
--
BEGIN;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'REPLACE_WITH_NON_ADMIN_USER_ID', true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'REPLACE_WITH_NON_ADMIN_USER_ID',
    'role', 'authenticated',
    'email', 'audit@example.com'
  )::text,
  true
);
SET LOCAL ROLE authenticated;

WITH checks AS (
  SELECT
    'current role' AS check_name,
    current_user::text AS result

  UNION ALL

  SELECT
    'simulated user id' AS check_name,
    coalesce(auth.uid()::text, 'null') AS result

  UNION ALL

  SELECT
    'private_profile_data own row' AS check_name,
    count(*)::text AS result
  FROM public.private_profile_data
  WHERE user_id = 'REPLACE_WITH_NON_ADMIN_USER_ID'

  UNION ALL

  SELECT
    'private_profile_data other row' AS check_name,
    count(*)::text AS result
  FROM public.private_profile_data
  WHERE user_id = 'REPLACE_WITH_OTHER_USER_ID'

  UNION ALL

  SELECT
    'admin_profile_stats privilege' AS check_name,
    has_table_privilege(current_user, 'public.admin_profile_stats', 'SELECT')::text AS result

  UNION ALL

  SELECT
    'visible matching_rules rows' AS check_name,
    count(*)::text AS result
  FROM public.matching_rules

  UNION ALL

  SELECT
    'visible dates touching me' AS check_name,
    count(*)::text AS result
  FROM public.dates
  WHERE user1_id = 'REPLACE_WITH_NON_ADMIN_USER_ID'
     OR user2_id = 'REPLACE_WITH_NON_ADMIN_USER_ID'

  UNION ALL

  SELECT
    'visible dates touching someone else only' AS check_name,
    count(*)::text AS result
  FROM public.dates
  WHERE user1_id = 'REPLACE_WITH_OTHER_USER_ID'
     OR user2_id = 'REPLACE_WITH_OTHER_USER_ID'
)
SELECT *
FROM checks;

ROLLBACK;
