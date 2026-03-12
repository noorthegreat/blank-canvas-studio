-- Create a view to aggregate profile statistics for the admin dashboard
-- This avoids complex joins and cartesian products in the application layer
-- and allows for server-side sorting/pagination.

DROP VIEW IF EXISTS admin_profile_stats;

CREATE VIEW admin_profile_stats AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.photo_url,
  p.age,
  p.created_at,
  p.completed_questionnaire,
  p.completed_friendship_questionnaire,
  (SELECT COUNT(DISTINCT matched_user_id) FROM match_history mh WHERE mh.user_id = p.id) as total_matches,
  (SELECT COUNT(*) FROM likes l WHERE l.liked_user_id = p.id) as likes_received,
  (SELECT COUNT(*) FROM likes l WHERE l.user_id = p.id) as likes_given,
  (SELECT COUNT(*) FROM dates d WHERE d.user1_id = p.id OR d.user2_id = p.id) as total_dates,
  (SELECT COUNT(*) FROM dates d WHERE (d.user1_id = p.id OR d.user2_id = p.id) AND d.status = 'completed') as completed_dates
FROM profiles p;

-- Grant access to the view (adjust roles as necessary for your RLS setup)
GRANT SELECT ON admin_profile_stats TO authenticated;
GRANT SELECT ON admin_profile_stats TO service_role;
