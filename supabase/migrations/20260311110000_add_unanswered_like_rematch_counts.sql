CREATE TABLE IF NOT EXISTS public.unanswered_like_rematch_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matched_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_type public.match_type NOT NULL,
  unanswered_like_count integer NOT NULL DEFAULT 0 CHECK (unanswered_like_count >= 0),
  last_pairing_created_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, matched_user_id, match_type),
  CHECK (user_id <> matched_user_id)
);

CREATE INDEX IF NOT EXISTS idx_unanswered_like_rematch_counts_user_id
  ON public.unanswered_like_rematch_counts(user_id);

CREATE INDEX IF NOT EXISTS idx_unanswered_like_rematch_counts_matched_user_id
  ON public.unanswered_like_rematch_counts(matched_user_id);

CREATE INDEX IF NOT EXISTS idx_unanswered_like_rematch_counts_match_type
  ON public.unanswered_like_rematch_counts(match_type);

ALTER TABLE public.unanswered_like_rematch_counts ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.unanswered_like_rematch_counts TO service_role;
