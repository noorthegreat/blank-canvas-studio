-- One-time clean-slate reset before student-only Monday drops.
-- Goal:
-- 1) Cancel all open dates (pending/limbo/confirmed)
-- 2) Delete all current matches
-- 3) Clear likes between users who were currently matched, so they can rematch cleanly
--
-- Notes:
-- - Completed/cancelled/auto_cancelled dates are preserved.
-- - match_history is preserved for analytics/audit.
-- - dislikes are preserved (users keep their explicit "no" decisions).

BEGIN;

-- Snapshot current match pairs so we can remove only those likes.
CREATE TEMP TABLE _reset_pairs ON COMMIT DROP AS
SELECT DISTINCT
  LEAST(user_id, matched_user_id) AS user_a,
  GREATEST(user_id, matched_user_id) AS user_b
FROM public.matches;

WITH cancelled_dates AS (
  UPDATE public.dates d
  SET
    status = 'cancelled',
    completed_or_cancelled_at = COALESCE(d.completed_or_cancelled_at, now()),
    is_completed = false,
    notes = CONCAT(
      COALESCE(d.notes || E'\n', ''),
      '[system reset 2026-02-26] Clean-slate reset before student-only Monday drop.'
    )
  WHERE d.status IN ('pending', 'limbo', 'confirmed')
  RETURNING d.id
),
deleted_matches AS (
  DELETE FROM public.matches m
  RETURNING m.id
),
deleted_likes AS (
  DELETE FROM public.likes l
  USING _reset_pairs p
  WHERE LEAST(l.user_id, l.liked_user_id) = p.user_a
    AND GREATEST(l.user_id, l.liked_user_id) = p.user_b
  RETURNING l.id
)
SELECT
  (SELECT count(*) FROM _reset_pairs) AS reset_pair_count,
  (SELECT count(*) FROM cancelled_dates) AS cancelled_open_dates_count,
  (SELECT count(*) FROM deleted_matches) AS deleted_matches_count,
  (SELECT count(*) FROM deleted_likes) AS deleted_likes_for_old_pairs_count;

COMMIT;

-- Optional (NOT enabled): also clear dislikes between old matched pairs.
-- DELETE FROM public.dislikes d
-- USING _reset_pairs p
-- WHERE LEAST(d.user_id, d.disliked_user_id) = p.user_a
--   AND GREATEST(d.user_id, d.disliked_user_id) = p.user_b;
