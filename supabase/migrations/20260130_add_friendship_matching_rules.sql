-- Migration to add matching rules for all friendship questions
-- Algorithm: friendship
-- Rule Type: modifier (default for scoring matches)
-- Operator: set_similarity for multi-select, equals for others

INSERT INTO public.matching_rules (
    name,
    description,
    rule_type,
    is_active,
    source_type,
    source_ref,
    target_type,
    target_ref,
    operator,
    weight,
    algorithm,
    condition,
    params
)
SELECT
    'Friendship: ' || question,        -- Name: "Friendship Score: [Question Text]"
    'Generated rule for question: ' || question, -- Description
    'modifier',                              -- rule_type: modifier (for scoring)
    true,                                    -- is_active: true
    'question',                              -- source_type: question
    id::text,                                -- source_ref: question ID
    'question',                              -- target_type: question
    id::text,                                -- target_ref: question ID (compare to same question)
    CASE
        WHEN multi_select = true THEN 'set_similarity' -- Use set_similarity for multi-select
        ELSE 'equals'                                  -- Use equals for single choice / scalars
    END,                                     -- operator
    1.0,                                     -- weight: default to 1.0
    'friendship',                            -- algorithm: set to friendship
    NULL,                                    -- condition: none
    CASE
        WHEN multi_select = true THEN '{}'::jsonb
        ELSE '{}'::jsonb                     -- params: empty for now
    END                                      -- params
FROM public.friendship_questions;
