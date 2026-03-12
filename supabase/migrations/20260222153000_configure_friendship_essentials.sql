-- Configure friendship survey essentials as one combined "Basics" block.
-- Also standardize wording/options and ensure those items are not repeated later.

ALTER TABLE public.friendship_questions
ADD COLUMN IF NOT EXISTS combined boolean DEFAULT false;

DO $$
DECLARE
  q_gender int;
  q_open_to_friends int;
  q_friendship_type int;
  q_age_range int;
  q_habits int;
  q_dealbreakers int;
  q_languages int;
  next_order int;
BEGIN
  SELECT COALESCE(MAX(order_index), MAX(id), 0) INTO next_order
  FROM public.friendship_questions;

  -- 1) Gender
  SELECT id INTO q_gender
  FROM public.friendship_questions
  WHERE lower(question) ~ 'identify.*gender'
  ORDER BY id
  LIMIT 1;

  IF q_gender IS NULL THEN
    next_order := next_order + 1;
    INSERT INTO public.friendship_questions (
      question, options, min_responses, max_responses, multi_select, show_if,
      range_slider, min_value, max_value, default_range, allow_custom, has_dropdown,
      ranked, default_answer, disabled, order_index, combined
    ) VALUES (
      'How do you identify your gender?',
      '[{"value":"A","label":"Woman"},{"value":"B","label":"Man"},{"value":"C","label":"Non-binary"},{"value":"D","label":"Prefer not to say"}]'::jsonb,
      NULL, NULL, false, NULL,
      false, NULL, NULL, NULL, false, false,
      false, NULL, false, next_order, true
    )
    RETURNING id INTO q_gender;
  ELSE
    UPDATE public.friendship_questions
    SET question = 'How do you identify your gender?',
        options = '[{"value":"A","label":"Woman"},{"value":"B","label":"Man"},{"value":"C","label":"Non-binary"},{"value":"D","label":"Prefer not to say"}]'::jsonb,
        min_responses = NULL,
        max_responses = NULL,
        multi_select = false,
        range_slider = false,
        min_value = NULL,
        max_value = NULL,
        default_range = NULL,
        allow_custom = false,
        has_dropdown = false,
        ranked = false,
        default_answer = NULL,
        disabled = false,
        combined = true
    WHERE id = q_gender;
  END IF;

  -- 2) Preferred gender for friends
  SELECT id INTO q_open_to_friends
  FROM public.friendship_questions
  WHERE lower(question) ~ 'open to.*friends'
     OR lower(question) ~ 'preferred gender.*friend'
  ORDER BY id
  LIMIT 1;

  IF q_open_to_friends IS NULL THEN
    next_order := next_order + 1;
    INSERT INTO public.friendship_questions (
      question, options, min_responses, max_responses, multi_select, show_if,
      range_slider, min_value, max_value, default_range, allow_custom, has_dropdown,
      ranked, default_answer, disabled, order_index, combined
    ) VALUES (
      '*Who are you open to being friends with?',
      '[{"value":"A","label":"Women"},{"value":"B","label":"Men"},{"value":"C","label":"Non-binary people"}]'::jsonb,
      1, NULL, true, NULL,
      false, NULL, NULL, NULL, false, false,
      false, NULL, false, next_order, true
    )
    RETURNING id INTO q_open_to_friends;
  ELSE
    UPDATE public.friendship_questions
    SET question = '*Who are you open to being friends with?',
        options = '[{"value":"A","label":"Women"},{"value":"B","label":"Men"},{"value":"C","label":"Non-binary people"}]'::jsonb,
        min_responses = 1,
        max_responses = NULL,
        multi_select = true,
        range_slider = false,
        min_value = NULL,
        max_value = NULL,
        default_range = NULL,
        allow_custom = false,
        has_dropdown = false,
        ranked = false,
        default_answer = NULL,
        disabled = false,
        combined = true
    WHERE id = q_open_to_friends;
  END IF;

  -- 3) Friendship type
  SELECT id INTO q_friendship_type
  FROM public.friendship_questions
  WHERE lower(question) ~ 'what kind of friendship are you looking for'
     OR lower(question) ~ 'friendship.*looking for'
  ORDER BY id
  LIMIT 1;

  IF q_friendship_type IS NULL THEN
    next_order := next_order + 1;
    INSERT INTO public.friendship_questions (
      question, options, min_responses, max_responses, multi_select, show_if,
      range_slider, min_value, max_value, default_range, allow_custom, has_dropdown,
      ranked, default_answer, disabled, order_index, combined
    ) VALUES (
      'What kind of friendship are you looking for?',
      '[{"value":"A","label":"Casual and light"},{"value":"B","label":"Consistent and reliable"},{"value":"C","label":"Deep and meaningful"},{"value":"D","label":"Open and flexible"}]'::jsonb,
      NULL, NULL, false, NULL,
      false, NULL, NULL, NULL, false, false,
      false, NULL, false, next_order, true
    )
    RETURNING id INTO q_friendship_type;
  ELSE
    UPDATE public.friendship_questions
    SET question = 'What kind of friendship are you looking for?',
        options = '[{"value":"A","label":"Casual and light"},{"value":"B","label":"Consistent and reliable"},{"value":"C","label":"Deep and meaningful"},{"value":"D","label":"Open and flexible"}]'::jsonb,
        min_responses = NULL,
        max_responses = NULL,
        multi_select = false,
        range_slider = false,
        min_value = NULL,
        max_value = NULL,
        default_range = NULL,
        allow_custom = false,
        has_dropdown = false,
        ranked = false,
        default_answer = NULL,
        disabled = false,
        combined = true
    WHERE id = q_friendship_type;
  END IF;

  -- 4) Preferred age range for friend (slider)
  SELECT id INTO q_age_range
  FROM public.friendship_questions
  WHERE lower(question) ~ 'preferred age range'
  ORDER BY id
  LIMIT 1;

  IF q_age_range IS NULL THEN
    next_order := next_order + 1;
    INSERT INTO public.friendship_questions (
      question, options, min_responses, max_responses, multi_select, show_if,
      range_slider, min_value, max_value, default_range, allow_custom, has_dropdown,
      ranked, default_answer, disabled, order_index, combined
    ) VALUES (
      'What is your preferred age range for a friend?',
      '[]'::jsonb,
      NULL, NULL, false, NULL,
      true, 18, 99, '{25,35}'::int[], false, false,
      false, NULL, false, next_order, true
    )
    RETURNING id INTO q_age_range;
  ELSE
    UPDATE public.friendship_questions
    SET question = 'What is your preferred age range for a friend?',
        options = '[]'::jsonb,
        min_responses = NULL,
        max_responses = NULL,
        multi_select = false,
        range_slider = true,
        min_value = 18,
        max_value = 99,
        default_range = '{25,35}'::int[],
        allow_custom = false,
        has_dropdown = false,
        ranked = false,
        default_answer = NULL,
        disabled = false,
        combined = true
    WHERE id = q_age_range;
  END IF;

  -- 5) Habits
  SELECT id INTO q_habits
  FROM public.friendship_questions
  WHERE lower(question) ~ 'do you do any of the following'
  ORDER BY id
  LIMIT 1;

  IF q_habits IS NULL THEN
    next_order := next_order + 1;
    INSERT INTO public.friendship_questions (
      question, options, min_responses, max_responses, multi_select, show_if,
      range_slider, min_value, max_value, default_range, allow_custom, has_dropdown,
      ranked, default_answer, disabled, order_index, combined
    ) VALUES (
      '*Do you do any of the following?',
      '[{"value":"A","label":"Smoking"},{"value":"B","label":"Drinking"},{"value":"C","label":"Drugs"}]'::jsonb,
      0, NULL, true, NULL,
      false, NULL, NULL, NULL, false, false,
      false, NULL, false, next_order, true
    )
    RETURNING id INTO q_habits;
  ELSE
    UPDATE public.friendship_questions
    SET question = '*Do you do any of the following?',
        options = '[{"value":"A","label":"Smoking"},{"value":"B","label":"Drinking"},{"value":"C","label":"Drugs"}]'::jsonb,
        min_responses = 0,
        max_responses = NULL,
        multi_select = true,
        range_slider = false,
        min_value = NULL,
        max_value = NULL,
        default_range = NULL,
        allow_custom = false,
        has_dropdown = false,
        ranked = false,
        default_answer = NULL,
        disabled = false,
        combined = true
    WHERE id = q_habits;
  END IF;

  -- 6) Dealbreakers
  SELECT id INTO q_dealbreakers
  FROM public.friendship_questions
  WHERE lower(question) ~ 'dealbreaker'
  ORDER BY id
  LIMIT 1;

  IF q_dealbreakers IS NULL THEN
    next_order := next_order + 1;
    INSERT INTO public.friendship_questions (
      question, options, min_responses, max_responses, multi_select, show_if,
      range_slider, min_value, max_value, default_range, allow_custom, has_dropdown,
      ranked, default_answer, disabled, order_index, combined
    ) VALUES (
      '*Are any of those a dealbreaker in a friend?',
      '[{"value":"A","label":"Smoking"},{"value":"B","label":"Drinking"},{"value":"C","label":"Drugs"}]'::jsonb,
      0, NULL, true, NULL,
      false, NULL, NULL, NULL, false, false,
      false, NULL, false, next_order, true
    )
    RETURNING id INTO q_dealbreakers;
  ELSE
    UPDATE public.friendship_questions
    SET question = '*Are any of those a dealbreaker in a friend?',
        options = '[{"value":"A","label":"Smoking"},{"value":"B","label":"Drinking"},{"value":"C","label":"Drugs"}]'::jsonb,
        min_responses = 0,
        max_responses = NULL,
        multi_select = true,
        range_slider = false,
        min_value = NULL,
        max_value = NULL,
        default_range = NULL,
        allow_custom = false,
        has_dropdown = false,
        ranked = false,
        default_answer = NULL,
        disabled = false,
        combined = true
    WHERE id = q_dealbreakers;
  END IF;

  -- 7) Languages
  SELECT id INTO q_languages
  FROM public.friendship_questions
  WHERE lower(question) ~ 'which languages'
  ORDER BY id
  LIMIT 1;

  IF q_languages IS NULL THEN
    next_order := next_order + 1;
    INSERT INTO public.friendship_questions (
      question, options, min_responses, max_responses, multi_select, show_if,
      range_slider, min_value, max_value, default_range, allow_custom, has_dropdown,
      ranked, default_answer, disabled, order_index, combined
    ) VALUES (
      '*Which languages can you comfortably speak with a friend?',
      '[{"value":"A","label":"English"},{"value":"B","label":"German"},{"value":"C","label":"Swiss-German"},{"value":"D","label":"French"},{"value":"E","label":"Italian"},{"value":"F","label":"Spanish"},{"value":"G","label":"Arabic"},{"value":"H","label":"Russian"}]'::jsonb,
      1, NULL, true, NULL,
      false, NULL, NULL, NULL, false, false,
      false, NULL, false, next_order, true
    )
    RETURNING id INTO q_languages;
  ELSE
    UPDATE public.friendship_questions
    SET question = '*Which languages can you comfortably speak with a friend?',
        options = '[{"value":"A","label":"English"},{"value":"B","label":"German"},{"value":"C","label":"Swiss-German"},{"value":"D","label":"French"},{"value":"E","label":"Italian"},{"value":"F","label":"Spanish"},{"value":"G","label":"Arabic"},{"value":"H","label":"Russian"}]'::jsonb,
        min_responses = 1,
        max_responses = NULL,
        multi_select = true,
        range_slider = false,
        min_value = NULL,
        max_value = NULL,
        default_range = NULL,
        allow_custom = false,
        has_dropdown = false,
        ranked = false,
        default_answer = NULL,
        disabled = false,
        combined = true
    WHERE id = q_languages;
  END IF;

  -- Ensure essentials appear first within order_index.
  UPDATE public.friendship_questions SET order_index = 1, combined = true WHERE id = q_gender;
  UPDATE public.friendship_questions SET order_index = 2, combined = true WHERE id = q_open_to_friends;
  UPDATE public.friendship_questions SET order_index = 3, combined = true WHERE id = q_friendship_type;
  UPDATE public.friendship_questions SET order_index = 4, combined = true WHERE id = q_age_range;
  UPDATE public.friendship_questions SET order_index = 5, combined = true WHERE id = q_habits;
  UPDATE public.friendship_questions SET order_index = 6, combined = true WHERE id = q_dealbreakers;
  UPDATE public.friendship_questions SET order_index = 7, combined = true WHERE id = q_languages;

  -- Prevent repeats: all non-essentials are not part of combined block.
  UPDATE public.friendship_questions
  SET combined = false
  WHERE id NOT IN (q_gender, q_open_to_friends, q_friendship_type, q_age_range, q_habits, q_dealbreakers, q_languages);
END $$;
