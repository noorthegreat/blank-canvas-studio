-- Dedicated friendship interaction tracking (separate from romantic likes/dislikes)

CREATE TABLE IF NOT EXISTS public.friendship_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, liked_user_id),
  CHECK (user_id <> liked_user_id)
);

CREATE TABLE IF NOT EXISTS public.friendship_dislikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disliked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, disliked_user_id),
  CHECK (user_id <> disliked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friendship_likes_user_id ON public.friendship_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_friendship_likes_liked_user_id ON public.friendship_likes(liked_user_id);
CREATE INDEX IF NOT EXISTS idx_friendship_dislikes_user_id ON public.friendship_dislikes(user_id);
CREATE INDEX IF NOT EXISTS idx_friendship_dislikes_disliked_user_id ON public.friendship_dislikes(disliked_user_id);

ALTER TABLE public.friendship_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendship_dislikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own friendship likes" ON public.friendship_likes;
CREATE POLICY "Users can insert their own friendship likes"
ON public.friendship_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select friendship likes involving them" ON public.friendship_likes;
CREATE POLICY "Users can select friendship likes involving them"
ON public.friendship_likes
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = liked_user_id);

DROP POLICY IF EXISTS "Users can delete their own friendship likes" ON public.friendship_likes;
CREATE POLICY "Users can delete their own friendship likes"
ON public.friendship_likes
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own friendship dislikes" ON public.friendship_dislikes;
CREATE POLICY "Users can insert their own friendship dislikes"
ON public.friendship_dislikes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select friendship dislikes involving them" ON public.friendship_dislikes;
CREATE POLICY "Users can select friendship dislikes involving them"
ON public.friendship_dislikes
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = disliked_user_id);

DROP POLICY IF EXISTS "Users can delete their own friendship dislikes" ON public.friendship_dislikes;
CREATE POLICY "Users can delete their own friendship dislikes"
ON public.friendship_dislikes
FOR DELETE
USING (auth.uid() = user_id);
