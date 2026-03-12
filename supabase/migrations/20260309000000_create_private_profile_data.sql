-- Create private_profile_data table to hold sensitive user info that should
-- not be accessible by other authenticated users (e.g. email, phone, location).
-- Only the owning user and admins can read rows in this table.

CREATE TABLE public.private_profile_data (
    user_id     uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    email       text,
    last_name   text,
    birthday    text,
    phone_number text,
    latitude    double precision,
    longitude   double precision,
    created_at  timestamptz DEFAULT now() NOT NULL,
    updated_at  timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.private_profile_data ENABLE ROW LEVEL SECURITY;

-- Users can read their own private data
CREATE POLICY "Users can view own private data"
ON public.private_profile_data
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own private data
CREATE POLICY "Users can insert own private data"
ON public.private_profile_data
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own private data
CREATE POLICY "Users can update own private data"
ON public.private_profile_data
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can read all private data
CREATE POLICY "Admins can view all private data"
ON public.private_profile_data
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'admin'
    )
);

-- Migrate existing sensitive data from profiles into private_profile_data
INSERT INTO public.private_profile_data (
    user_id, email, last_name, birthday, phone_number, latitude, longitude, created_at, updated_at
)
SELECT
    id,
    email,
    last_name,
    birthday,
    phone_number,
    latitude,
    longitude,
    COALESCE(created_at, now()),
    COALESCE(updated_at, now())
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Drop the view first (it depends on columns we're about to remove)
DROP VIEW IF EXISTS admin_profile_stats;

-- Remove sensitive columns from the public profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS last_name;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS birthday;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone_number;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS latitude;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS longitude;

-- Recreate admin_profile_stats view joining private_profile_data.
-- With SECURITY INVOKER (the default), RLS on private_profile_data applies:
--   - Admins see email/last_name for every profile.
--   - Non-admins see NULL for those columns on all rows except their own.

CREATE VIEW admin_profile_stats AS
SELECT
  p.id,
  p.first_name,
  ppd.last_name,
  ppd.email,
  p.photo_url,
  p.age,
  p.created_at,
  p.completed_questionnaire,
  p.completed_friendship_questionnaire,
  (SELECT COUNT(DISTINCT matched_user_id) FROM match_history mh WHERE mh.user_id = p.id) AS total_matches,
  (SELECT COUNT(*) FROM likes l WHERE l.liked_user_id = p.id) AS likes_received,
  (SELECT COUNT(*) FROM likes l WHERE l.user_id = p.id) AS likes_given,
  (SELECT COUNT(*) FROM dates d WHERE d.user1_id = p.id OR d.user2_id = p.id) AS total_dates,
  (SELECT COUNT(*) FROM dates d WHERE (d.user1_id = p.id OR d.user2_id = p.id) AND d.status = 'completed') AS completed_dates
FROM profiles p
LEFT JOIN private_profile_data ppd ON ppd.user_id = p.id;

GRANT SELECT ON admin_profile_stats TO authenticated;
GRANT SELECT ON admin_profile_stats TO service_role;
