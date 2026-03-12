-- Create matching_rules table
CREATE TABLE IF NOT EXISTS "public"."matching_rules" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "rule_type" text NOT NULL CHECK (rule_type IN ('dealbreaker', 'modifier')),
    "is_active" boolean DEFAULT true NOT NULL,
    
    -- Source definition (e.g., User 1's Answer to Q16)
    "source_type" text NOT NULL CHECK (source_type IN ('question', 'profile', 'computed', 'table')),
    "source_ref" text, -- question ID (e.g., '16') or profile column ('age')
    
    -- Target definition (e.g., User 2's Answer to Q17)
    "target_type" text CHECK (target_type IN ('question', 'profile', 'computed', 'constant')),
    "target_ref" text, 
    
    -- Comparison logic
    "operator" text NOT NULL, -- e.g., 'equals', 'intersects', 'contains', 'range_includes', 'distance_lte'
    
    -- Conditional execution (Optional: only run this rule if User 1 Answer Q26 = 'A')
    "condition" jsonb, 
    
    -- Weight (for modifiers only)
    "weight" double precision DEFAULT 1.0,
    
    -- Additional parameters (mappings, thresholds, etc.)
    "params" jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE "public"."matching_rules" ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users (or service role)
CREATE POLICY "Allow read access to anyone" ON "public"."matching_rules" FOR SELECT USING (true);
CREATE POLICY "Allow all access to service role" ON "public"."matching_rules" USING (auth.role() = 'service_role');

-- SEED DATA: Dealbreakers

-- 1. Gender: User 1 Gender must be in User 2's Open To
INSERT INTO "public"."matching_rules" 
(name, rule_type, source_type, source_ref, target_type, target_ref, operator, params)
VALUES 
('Gender Preference (User 1 -> User 2)', 'dealbreaker', 'question', '16', 'question', '17', 'mapped_subset', '{"mapping": {"A": "B", "B": "A", "C": "C"}}'),
('Gender Preference (User 2 -> User 1)', 'dealbreaker', 'question', '16', 'question', '17', 'mapped_subset_reverse', '{"mapping": {"A": "B", "B": "A", "C": "C"}}');

-- 2. Relationship Type (Q18): Must match exactly
INSERT INTO "public"."matching_rules" 
(name, rule_type, source_type, source_ref, target_type, target_ref, operator)
VALUES 
('Relationship Type Match', 'dealbreaker', 'question', '18', 'question', '18', 'equals');

-- 3. Age Range (Q20 vs Profile Age)
INSERT INTO "public"."matching_rules" 
(name, rule_type, source_type, source_ref, target_type, target_ref, operator)
VALUES 
('Age Preference (User 1 -> User 2)', 'dealbreaker', 'question', '20', 'profile', 'age', 'range_includes'),
('Age Preference (User 2 -> User 1)', 'dealbreaker', 'question', '20', 'profile', 'age', 'range_includes_reverse');

-- 4. Habits (Q21 vs Q22)
-- User 1 habits (Q21) must NOT be in User 2 dealbreakers (Q22)
INSERT INTO "public"."matching_rules" 
(name, rule_type, source_type, source_ref, target_type, target_ref, operator)
VALUES 
('Habit Dealbreakers (User 1 -> User 2)', 'dealbreaker', 'question', '21', 'question', '22', 'none_present_in'),
('Habit Dealbreakers (User 2 -> User 1)', 'dealbreaker', 'question', '21', 'question', '22', 'none_present_in_reverse');

-- 5. Language (Q25): Must share at least one
INSERT INTO "public"."matching_rules" 
(name, rule_type, source_type, source_ref, target_type, target_ref, operator)
VALUES 
('Shared Language', 'dealbreaker', 'question', '25', 'question', '25', 'intersects');

-- 6. Culture (Q26/Q27): If Q26="A", Q27 must intersect
INSERT INTO "public"."matching_rules" 
(name, rule_type, source_type, source_ref, target_type, target_ref, operator, condition)
VALUES 
('Cultural Preference (User 1)', 'dealbreaker', 'question', '27', 'question', '27', 'intersects', '{"source_type": "question", "source_ref": "26", "operator": "equals", "value": "A"}'),
('Cultural Preference (User 2)', 'dealbreaker', 'question', '27', 'question', '27', 'intersects', '{"target_type": "question", "target_ref": "26", "operator": "equals", "value": "A"}');

-- 7. Religion (Q29/Q28): If Q29="A", Q28 must equal
INSERT INTO "public"."matching_rules" 
(name, rule_type, source_type, source_ref, target_type, target_ref, operator, condition)
VALUES 
('Religion Preference (User 1)', 'dealbreaker', 'question', '28', 'question', '28', 'equals', '{"source_type": "question", "source_ref": "29", "operator": "equals", "value": "A"}'),
('Religion Preference (User 2)', 'dealbreaker', 'question', '28', 'question', '28', 'equals', '{"target_type": "question", "target_ref": "29", "operator": "equals", "value": "A"}');

-- 8. Politics (Q31/Q30): If Q31="A", Q30 must equal
INSERT INTO "public"."matching_rules" 
(name, rule_type, source_type, source_ref, target_type, target_ref, operator, condition)
VALUES 
('Politics Preference (User 1)', 'dealbreaker', 'question', '30', 'question', '30', 'equals', '{"source_type": "question", "source_ref": "31", "operator": "equals", "value": "A"}'),
('Politics Preference (User 2)', 'dealbreaker', 'question', '30', 'question', '30', 'equals', '{"target_type": "question", "target_ref": "31", "operator": "equals", "value": "A"}');

-- 9. Shared Interests (Q33/Q32): If either Q33="A", Q32 must intersect
INSERT INTO "public"."matching_rules" 
(name, rule_type, source_type, source_ref, target_type, target_ref, operator, condition)
VALUES 
('Shared Interests Requirement (User 1)', 'dealbreaker', 'question', '32', 'question', '32', 'intersects', '{"source_type": "question", "source_ref": "33", "operator": "equals", "value": "A"}'),
('Shared Interests Requirement (User 2)', 'dealbreaker', 'question', '32', 'question', '32', 'intersects', '{"target_type": "question", "target_ref": "33", "operator": "equals", "value": "A"}');

-- 10. Dislikes: Check dislikes table
INSERT INTO "public"."matching_rules" 
(name, rule_type, source_type, source_ref, target_type, target_ref, operator)
VALUES 
('Check Dislikes Table', 'dealbreaker', 'table', 'dislikes', 'profile', 'id', 'not_exists_in_table');

-- 11. Distance: 15 miles max
INSERT INTO "public"."matching_rules" 
(name, rule_type, source_type, source_ref, target_type, target_ref, operator, params)
VALUES 
('Max Distance', 'dealbreaker', 'profile', 'location', 'profile', 'location', 'distance_lte', '{"value": 15}');


-- SEED DATA: Modifiers (Weights)

-- Simple weights
INSERT INTO "public"."matching_rules" (name, rule_type, source_type, source_ref, target_type, target_ref, operator, weight) VALUES
('Score: Perfect Day', 'modifier', 'question', '2', 'question', '2', 'equals', 3),
('Score: Friday Night', 'modifier', 'question', '4', 'question', '4', 'equals', 3),
('Score: Spontaneity', 'modifier', 'question', '5', 'question', '5', 'equals', 2),
('Score: Communication', 'modifier', 'question', '6', 'question', '6', 'equals', 4),
('Score: Support', 'modifier', 'question', '7', 'question', '7', 'equals', 3),
('Score: Closeness', 'modifier', 'question', '8', 'question', '8', 'equals', 4),
('Score: Independence', 'modifier', 'question', '9', 'question', '9', 'equals', 4),
('Score: Emotional Awareness', 'modifier', 'question', '10', 'question', '10', 'equals', 3),
('Score: Attachment', 'modifier', 'question', '11', 'question', '11', 'equals', 3),
('Score: Anxiety', 'modifier', 'question', '12', 'question', '12', 'equals', 3),
('Score: Love Language', 'modifier', 'question', '15', 'question', '15', 'equals', 2),
('Score: Kids', 'modifier', 'question', '19', 'question', '19', 'equals', 3);

-- Set Similarity (Multi-select)
INSERT INTO "public"."matching_rules" (name, rule_type, source_type, source_ref, target_type, target_ref, operator, weight) VALUES
('Score: Shared Interests', 'modifier', 'question', '32', 'question', '32', 'set_similarity', 5),
('Score: First Date', 'modifier', 'question', '34', 'question', '34', 'set_similarity', 2),
('Score: Values', 'modifier', 'question', '35', 'question', '35', 'set_similarity', 5),
('Score: Partner Qualities', 'modifier', 'question', '36', 'question', '36', 'set_similarity', 5);

-- Partial Credit (Adjacent Matches)
INSERT INTO "public"."matching_rules" (name, rule_type, source_type, source_ref, target_type, target_ref, operator, weight, params) VALUES
('Score: Time Together', 'modifier', 'question', '13', 'question', '13', 'equals_or_adjacent', 4, '{"adjacent_weight_multiplier": 0.5}'),
('Score: Sexual Connection', 'modifier', 'question', '14', 'question', '14', 'equals_or_adjacent', 3, '{"adjacent_weight_multiplier": 0.5}');

-- Activity Boost
INSERT INTO "public"."matching_rules" (name, rule_type, source_type, source_ref, target_type, target_ref, operator) VALUES
('Activity Boost', 'modifier', 'computed', 'last_sign_in_days', 'constant', null, 'boost_decay_recency');
