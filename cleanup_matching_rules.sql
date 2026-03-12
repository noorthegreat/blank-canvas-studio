-- 1. DELETE redundant 'User 2' and 'Reverse' rules
-- These are fully covered by the bidirectional nature of the matching logic
DELETE FROM matching_rules WHERE name = 'Gender Preference (User 2 -> User 1)';
DELETE FROM matching_rules WHERE name = 'Age Preference (User 2 -> User 1)';
DELETE FROM matching_rules WHERE name = 'Habit Dealbreakers (User 2 -> User 1)';
DELETE FROM matching_rules WHERE name = 'Cultural Preference (User 2)';
DELETE FROM matching_rules WHERE name = 'Religion Preference (User 2)';
DELETE FROM matching_rules WHERE name = 'Politics Preference (User 2)';
DELETE FROM matching_rules WHERE name = 'Shared Interests Requirement (User 2)';

-- 2. RENAME 'User 1' rules to be generic
UPDATE matching_rules SET name = 'Gender Preference' WHERE name = 'Gender Preference (User 1 -> User 2)';
UPDATE matching_rules SET name = 'Age Preference' WHERE name = 'Age Preference (User 1 -> User 2)';
UPDATE matching_rules SET name = 'Habit Dealbreakers' WHERE name = 'Habit Dealbreakers (User 1 -> User 2)';
UPDATE matching_rules SET name = 'Cultural Preference' WHERE name = 'Cultural Preference (User 1)';
UPDATE matching_rules SET name = 'Religion Preference' WHERE name = 'Religion Preference (User 1)';
UPDATE matching_rules SET name = 'Politics Preference' WHERE name = 'Politics Preference (User 1)';
UPDATE matching_rules SET name = 'Shared Interests Requirement' WHERE name = 'Shared Interests Requirement (User 1)';

-- 3. APPLY DESCRIPTIONS to all active rules (Generic + Scoring)

-- Dealbreakers (Hard Filters)
UPDATE matching_rules SET description = 'Ensures the potential match''s gender aligns with the user''s preferences.' WHERE name = 'Gender Preference';
UPDATE matching_rules SET description = 'Ensures both users are looking for the same type of relationship.' WHERE name = 'Relationship Type Match';
UPDATE matching_rules SET description = 'Ensures the potential match''s age falls within the user''s preferred age range.' WHERE name = 'Age Preference';
UPDATE matching_rules SET description = 'Prevents matching if the potential match has habits that are dealbreakers for the user.' WHERE name = 'Habit Dealbreakers';
UPDATE matching_rules SET description = 'Ensures both users speak at least one shared language.' WHERE name = 'Shared Language';

-- Conditional Dealbreakers
UPDATE matching_rules SET description = 'Ensures the potential match meets the user''s cultural background preference (if specified).' WHERE name = 'Cultural Preference';
UPDATE matching_rules SET description = 'Ensures the potential match meets the user''s religious preference (if specified).' WHERE name = 'Religion Preference';
UPDATE matching_rules SET description = 'Ensures the potential match meets the user''s political preference (if specified).' WHERE name = 'Politics Preference';
UPDATE matching_rules SET description = 'Ensures the potential match has the specific interests the user requires (if specified).' WHERE name = 'Shared Interests Requirement';

-- System Dealbreakers
UPDATE matching_rules SET description = 'Prevents matching if either user has explicitly disliked the other.' WHERE name = 'Check Dislikes Table';
UPDATE matching_rules SET description = 'Ensures users are within a 15-mile radius of each other.' WHERE name = 'Max Distance';

-- Modifiers (Scoring) - Values & Lifestyle
UPDATE matching_rules SET description = 'Boosts score if users share similar personal values.' WHERE name = 'Score: Values';
UPDATE matching_rules SET description = 'Boosts score if users prioritize similar partner qualities.' WHERE name = 'Score: Partner Qualities';
UPDATE matching_rules SET description = 'Boosts score if users have similar preferences for time spent together.' WHERE name = 'Score: Time Together';
UPDATE matching_rules SET description = 'Boosts score if users have compatible views on sexual connection.' WHERE name = 'Score: Sexual Connection';
UPDATE matching_rules SET description = 'Boosts score if users share the same idea of a perfect day.' WHERE name = 'Score: Perfect Day';
UPDATE matching_rules SET description = 'Boosts score if users have similar Friday night preferences.' WHERE name = 'Score: Friday Night';
UPDATE matching_rules SET description = 'Boosts score if users have similar levels of spontaneity.' WHERE name = 'Score: Spontaneity';

-- Modifiers (Scoring) - Emotional & Communication
UPDATE matching_rules SET description = 'Boosts score if users share similar communication styles.' WHERE name = 'Score: Communication';
UPDATE matching_rules SET description = 'Boosts score if users look for similar support dynamics.' WHERE name = 'Score: Support';
UPDATE matching_rules SET description = 'Boosts score if users desire similar levels of closeness.' WHERE name = 'Score: Closeness';
UPDATE matching_rules SET description = 'Boosts score if users value similar levels of independence.' WHERE name = 'Score: Independence';
UPDATE matching_rules SET description = 'Boosts score if users have similar emotional awareness.' WHERE name = 'Score: Emotional Awareness';
UPDATE matching_rules SET description = 'Boosts score if users have compatible attachment styles.' WHERE name = 'Score: Attachment';
UPDATE matching_rules SET description = 'Boosts score if users share similar anxiety levels.' WHERE name = 'Score: Anxiety';
UPDATE matching_rules SET description = 'Boosts score if users share the same primary love language.' WHERE name = 'Score: Love Language';

-- Modifiers (Scoring) - Future & Interests
UPDATE matching_rules SET description = 'Boosts score if users have compatible views on having children.' WHERE name = 'Score: Kids';
UPDATE matching_rules SET description = 'Boosts score based on the overlap of shared interests.' WHERE name = 'Score: Shared Interests';
UPDATE matching_rules SET description = 'Boosts score based on shared first date preferences.' WHERE name = 'Score: First Date';

-- System Modifiers
UPDATE matching_rules SET description = 'Boosts visibility for recently active users (within the last 7 days).' WHERE name = 'Activity Boost';
