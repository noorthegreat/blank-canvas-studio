UID quick reference:

emmanuelssr
b7fcb0f9-41c0-4c5d-87df-2fd08d539a91
emmanuelsr10
dc291dcf-12da-4608-97f7-c3df64c51b89
mrdoomboyo
30f3c908-1076-4728-8d0d-5686076efdaa

minaicen (deleted):
e1e53fa6-36b0-4fd2-b610-3c2e3e4e3f52

0. (-1) move off lovable and onto vercel or something
0. Proper issue tracking, an MD like this doesn't work lol
1. Proper favicon, pref via free https://realfavicongenerator.net/
2. When you have an account but no profile data, /auth should redirect to /profile-setup (for case when user signs up then immediately closes browser)
3. Let people leave questionnaire early and come back to it to browse parts of the website like public events etc
4. Questionnaire 'Other' field lets you bypass maxresponses by 1
5. Questionnaire 'Other' lets you submit when empty
6. Custom 'Other' text on questino 40, 41, 42
7. Store actual question and answer text into the database for AI insight generation
8. custom answers with commas might mess up onchecked parts of input inline function
9. let test@test emails skip confirmation
10. postGres foreign key for join lookups to speed up things like generate-compatibility
11. Find a way to not run two seperate queries to get questionnaire answers? Maybe a column references questionnaire answers in profile
12. Store DB answers in a more scalable way
13. have nextQuestion be more solid, preferrably a function that runs on each question or smt
***
14. Add match/friend/pass after date, show them the phone number
15. fix outlook password reset thing
16. fix completed_questionnaire flow lol
17. Date timezones
18. Date venues in non-zurich locations
19. Check that the two location options for a date match timezones
20. figure out why 7d464e68-9acb-4749-ae27-0e4989b2cc8d isnt getting matches

Survey questions that have been replaced:
16 - What's your full name?
17 - What's your email?
18 - What's your phone number?
19 - When's your birthday?
20 - Which city are you dating from?
22 - Who are you open to dating? Removed redundant 'All Genders' choice
23 - Upload photo
24 - Upload photo
25 - Upload photo
28 - Do you have an age preference for a partner?

Preferred minimum age and maximum age changed from input to option between input and 'no preference'

Do you do any of the following? Removed redundant 'None of the above'
- Also, people might game this by selecting nothing cus its clear it can only limit your odds with the next question

Are any of these a dealbreaker for you in a partner? Removed redundant 'None of the above'

34 - Do the jobs need to be choices? Also graphic designer and fashion designer are so unrelated lol 

What's with question 2 and 3 being basically the same?

39- Is it important your partner shares it? -> shares your religion

mihael:
e1d37976-698a-4018-99fd-e4217f86d81f

first guy:
7d464e68-9acb-4749-ae27-0e4989b2cc8d

"question 40 of 40"
q 24 other starts selected

friend question 8
making more questions multiselect?
better security on admin stats view?
migrate feedback to new system
match/friend/pass update for friend date
dates auto delete after time
repeat insturctions on login
instructions on date page
mass email
- one explaining new version, privacy, reexplaining how we work
twilio for dates

Prompt for new edge function:

Can you create a new edge function that runs daily that checks all users for a mutual like, and ensures there is a date (in any state) that exists if a mutual like exists? And creates a date + notifies both users if one doesn't. 

It should also check if there are any pending dates such that the current date is 3 days past the end of the potential date window (the 3 days allow for late reschedules). Such dates should be cancelled with the reason "auto-cancelled as the date window has passed without reschedule", and both likes should be removed (so the users can re-like in the future). Both users should be notified with a new email template (don't forget to include it in the static_files field in the config file) that explains the situation and that they can re-like eachother in the future.

Create an admin tab that displays a graph where each node is an entry in the matching_rule table. Clicking on a node should open a dialog that allows admins to edit every aspect of it. Every edit should be able to be made directly with UI, i.e. there shouldn't ever be a spot where an admin has to type in JSON directly. This graph represents our matching algorithm. Also include hardcoded checks (such as the dislike check) as uneditable nodes that are purely visual.

Finally, add a button for running a dry-run and a debug-user-dry-run, and show the results in a clean, compact, and readable way.


// "supabase-mcp-server_shopify": {
//   "command": "npx",
//   "args": [
//     "-y",
//     "mcp-remote",
//     "https://mcp.supabase.com/mcp?project_ref=pjsjhejjpmoytpfwocjf&features=storage%2Cbranching%2Cfunctions%2Cdevelopment%2Cdebugging%2Cdatabase%2Caccount%2Cdocs"
//   ],
//   "env": {},
//   "disabledTools": []
// },

We now have three different matching_rules algorithms. Edit the match-users edge function to support this, by outputting three sets of matches: relationship, friendship, and event. 

The 'relationship' algorithm should:
- only run on people with "completed_questionnaire=true" in their profile.
- only use relationship matching_rules.
- should be based on 'personality_answers'. 
- should only produce up to 2 match pairs per user, with match_type=relationship, from_algorithm='relationship'.

The 'friendship' algorithm should:
- only run on people with "completed_friendship_questionnaire=true" in their profile.
- use friendship matching_rules.
- and should be based on 'friendship_answers'. 
- It should produce up to 2 match pairs per user as well, with match_type=friendship, from_algorithm='friendship'

the 'event' algorithm should:
- only run on people in the 'event_enrollments' table. 
- should create both relationship and friendship matches (when both users have completed the respeective questionnaires), prioritizing relationship matches if both would exist. from_algorithm='event'
- It should produce as many match pairs per user as as possible.

There should be an option in the headers to run a specific algorithm, or all of them. Dry run and debug user modes should still be supported.

setting answers for the 4-5 people's gender friendship question answers

for index:
trendy locations in zurich
concierge style dates setup for you, you just let us know when

instructions popup dialog also in about

admin event viewer: likes should only show for likes made on an event match
need to update Likes table to support algorithm type
Need to fix algorithm_type vs match_type bullshit in matches