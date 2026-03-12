-- Function to count gender distribution for an event
-- Determines gender from friendship_answers or personality_answers (fallback)
-- Assumes standard option keys: 'A' = Woman, 'B' = Man for gender questions

CREATE OR REPLACE FUNCTION public.get_event_gender_counts(event_name_param text)
RETURNS TABLE (
  gender text,
  count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  friendship_gender_q_id int;
  personality_gender_q_id int;
BEGIN
  -- Look up gender question ID in friendship_questions
  SELECT id INTO friendship_gender_q_id 
  FROM public.friendship_questions 
  WHERE question ILIKE '%identify your gender%' 
  LIMIT 1;

  -- Look up gender question ID in questionnaire_questions (personality)
  SELECT id INTO personality_gender_q_id 
  FROM public.questionnaire_questions 
  WHERE question ILIKE '%identify your gender%' 
  LIMIT 1;

  RETURN QUERY
  WITH event_participants AS (
    SELECT user_id 
    FROM public.event_enrollments 
    WHERE event_name = event_name_param
  ),
  participant_genders AS (
    SELECT
      ep.user_id,
      COALESCE(
        -- Try friendship answer first (most recent/relevant for some contexts?)
        -- Or prioritize friendship if it exists
        (SELECT answer FROM public.friendship_answers fa WHERE fa.user_id = ep.user_id AND fa.question_id = friendship_gender_q_id LIMIT 1),
        -- Fallback to personality answer
        (SELECT answer FROM public.personality_answers pa WHERE pa.user_id = ep.user_id AND pa.question_id = personality_gender_q_id LIMIT 1)
      ) as gender_answer
    FROM event_participants ep
  )
  SELECT
    CASE 
      WHEN pg.gender_answer = 'A' OR pg.gender_answer ILIKE 'Woman' THEN 'Woman'
      WHEN pg.gender_answer = 'B' OR pg.gender_answer ILIKE 'Man' THEN 'Man'
      ELSE 'Other' -- Includes Non-binary ('C'), Prefer not to say ('D'), etc.
    END as gender,
    COUNT(*) as count
  FROM participant_genders pg
  WHERE pg.gender_answer IS NOT NULL
  GROUP BY 1;
END;
$$;
