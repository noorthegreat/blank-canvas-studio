-- Backfill missing user_created_at in deleted_users
-- Sets user_created_at to 1 week before deleted_at for existing records where it is null
-- Also sets the flag had_to_guess_for_user_created_at to true

UPDATE deleted_users
SET 
  user_created_at = deleted_at - interval '1 week',
  had_to_guess_for_user_created_at = true
WHERE 
  user_created_at IS NULL;
