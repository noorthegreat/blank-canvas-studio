-- Disable distance-based dealbreaker rules so geolocation does not block matching.
-- Applies to all algorithms using matching_rules via match-users.
UPDATE public.matching_rules
SET is_active = false,
    updated_at = now()
WHERE operator = 'distance_lte'
  AND is_active = true;
