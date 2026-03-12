-- Debug feedback-gate eligibility for weekly relationship matches.
--
-- Purpose:
-- - Show which users are blocked from new matches because they have completed dates
--   without full feedback.
-- - Mirror the logic used in `supabase/functions/daily-cron/index.ts`.
--
-- Notes:
-- - "Incomplete feedback" means either:
--   1) follow-up preference is missing on dates table, or
--   2) no rows in date_feedback_answers for that user/date.
-- - This script focuses on profiles in the weekly matching pool:
--   completed_questionnaire = true and is_paused != true.

WITH candidate_profiles AS (
  SELECT p.id, p.email, p.first_name
  FROM public.profiles p
  WHERE p.completed_questionnaire = true
    AND COALESCE(p.is_paused, false) = false
),
completed_dates AS (
  SELECT
    d.id AS date_id,
    d.user1_id,
    d.user2_id,
    d.user1_followup_preference,
    d.user2_followup_preference
  FROM public.dates d
  WHERE d.status = 'completed'
),
user_date_feedback_state AS (
  -- User1 side
  SELECT
    cp.id AS user_id,
    cp.email,
    cp.first_name,
    cd.date_id,
    (cd.user1_followup_preference IS NOT NULL) AS has_followup_preference,
    EXISTS (
      SELECT 1
      FROM public.date_feedback_answers a
      WHERE a.date_id = cd.date_id
        AND a.user_id = cp.id
    ) AS has_answers
  FROM candidate_profiles cp
  JOIN completed_dates cd ON cd.user1_id = cp.id

  UNION ALL

  -- User2 side
  SELECT
    cp.id AS user_id,
    cp.email,
    cp.first_name,
    cd.date_id,
    (cd.user2_followup_preference IS NOT NULL) AS has_followup_preference,
    EXISTS (
      SELECT 1
      FROM public.date_feedback_answers a
      WHERE a.date_id = cd.date_id
        AND a.user_id = cp.id
    ) AS has_answers
  FROM candidate_profiles cp
  JOIN completed_dates cd ON cd.user2_id = cp.id
),
incomplete_feedback_rows AS (
  SELECT *
  FROM user_date_feedback_state
  WHERE NOT has_followup_preference
     OR NOT has_answers
),
blocked_users AS (
  SELECT
    user_id,
    MIN(email) AS email,
    MIN(first_name) AS first_name,
    COUNT(*) AS pending_completed_dates
  FROM incomplete_feedback_rows
  GROUP BY user_id
)
SELECT
  bu.user_id,
  bu.email,
  bu.first_name,
  bu.pending_completed_dates
FROM blocked_users bu
ORDER BY bu.pending_completed_dates DESC, bu.email;

-- Summary block:
-- Candidates before gate vs blocked vs eligible
WITH candidate_profiles AS (
  SELECT p.id
  FROM public.profiles p
  WHERE p.completed_questionnaire = true
    AND COALESCE(p.is_paused, false) = false
),
completed_dates AS (
  SELECT d.id AS date_id, d.user1_id, d.user2_id, d.user1_followup_preference, d.user2_followup_preference
  FROM public.dates d
  WHERE d.status = 'completed'
),
incomplete_users AS (
  SELECT DISTINCT cp.id AS user_id
  FROM candidate_profiles cp
  JOIN completed_dates cd ON cd.user1_id = cp.id
  WHERE cd.user1_followup_preference IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.date_feedback_answers a
       WHERE a.date_id = cd.date_id
         AND a.user_id = cp.id
     )

  UNION

  SELECT DISTINCT cp.id AS user_id
  FROM candidate_profiles cp
  JOIN completed_dates cd ON cd.user2_id = cp.id
  WHERE cd.user2_followup_preference IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.date_feedback_answers a
       WHERE a.date_id = cd.date_id
         AND a.user_id = cp.id
     )
)
SELECT
  (SELECT COUNT(*) FROM candidate_profiles) AS candidate_users,
  (SELECT COUNT(*) FROM incomplete_users) AS blocked_by_feedback_gate,
  (SELECT COUNT(*) FROM candidate_profiles) - (SELECT COUNT(*) FROM incomplete_users) AS eligible_after_feedback_gate;
