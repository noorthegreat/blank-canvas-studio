-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_matche_history_match_type ON public.match_history(match_type);
CREATE INDEX IF NOT EXISTS idx_matche_history_from_algorithm ON public.match_history(from_algorithm);
