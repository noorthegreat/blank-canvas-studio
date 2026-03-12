/*
Creates an AI-generated compatibility paragraph for a match.
Runs automatically when one user checks another user's profile.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'

//{ "userId1": "b7fcb0f9-41c0-4c5d-87df-2fd08d539a91","userId2": "736c6724-717c-43e6-a99e-789a8c39a0dd }
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const authHeader = req.headers.get("Authorization");

    // Create client for user authentication
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });

    // Verify JWT and get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("Authentication error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId1, userId2, force_regenerate, match_type } = await req.json();
    const isFriendship = match_type === 'friendship';
    console.log('Generating compatibility for users:', userId1, userId2, 'type:', match_type);

    // Authorization check: requester must be one of the two users OR an admin.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let isAdmin = false;
    try {
      const { data: hasAdminRole, error: roleError } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      if (!roleError && !!hasAdminRole) {
        isAdmin = true;
      }
    } catch (roleCheckError) {
      console.error("Error checking admin role:", roleCheckError);
    }

    if (user.id !== userId1 && user.id !== userId2 && !isAdmin) {
      console.error(`User ${user.id} attempted to check compatibility between ${userId1} and ${userId2}`);
      return new Response(
        JSON.stringify({ error: "Not authorized to view this compatibility" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Additional check: verify users are matched in either direction.
    const { data: matchDataForward } = await supabase
      .from('matches')
      .select('id')
      .eq('user_id', userId1)
      .eq('matched_user_id', userId2)
      .maybeSingle();

    const { data: matchDataReverse } = await supabase
      .from('matches')
      .select('id')
      .eq('user_id', userId2)
      .eq('matched_user_id', userId1)
      .maybeSingle();

    if (!matchDataForward && !matchDataReverse) {
      console.log('Users are not matched');
      return new Response(
        JSON.stringify({ error: "Compatibility can only be viewed for matched users" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authorization passed - generating compatibility');

    // Ensure consistent ordering of user IDs (user1_id < user2_id)
    const [smallerId, largerId] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

    if (!force_regenerate) {
      // Check if compatibility insight already exists
      const { data: existingInsight, error: fetchError } = await supabase
        .from('compatibility_insights')
        .select('compatibility_text')
        .eq('user1_id', smallerId)
        .eq('user2_id', largerId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching existing compatibility:', fetchError);
      }

      // If insight exists, return it
      if (existingInsight) {
        console.log('Returning cached compatibility insight');
        return new Response(
          JSON.stringify({ compatibility: existingInsight.compatibility_text }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('Force regenerate requested; skipping cache.');
    }

    // Fetch both users' answers — friendship_answers for friendship matches, personality_answers otherwise
    let answers1: any[] = [];
    let answers2: any[] = [];
    let questionsData: any[] = [];

    if (isFriendship) {
      const [r1, r2, rq] = await Promise.all([
        supabase.from('friendship_answers').select('question_number, question_id, answer, answer_custom').eq('user_id', userId1),
        supabase.from('friendship_answers').select('question_number, question_id, answer, answer_custom').eq('user_id', userId2),
        supabase.from('friendship_questions').select('id, question, options, order_index'),
      ]);
      answers1 = r1.data || [];
      answers2 = r2.data || [];
      questionsData = rq.data || [];
    } else {
      const [r1, r2, rq] = await Promise.all([
        supabase.from('personality_answers').select('question_number, answer').eq('user_id', userId1).order('question_number'),
        supabase.from('personality_answers').select('question_number, answer').eq('user_id', userId2).order('question_number'),
        supabase.from('questionnaire_questions').select('id, question, options'),
      ]);
      answers1 = r1.data || [];
      answers2 = r2.data || [];
      questionsData = rq.data || [];
    }

    if (!answers1.length || !answers2.length) {
      console.log("No questionnaire answers found");
      return new Response(
        JSON.stringify({ compatibility: "Complete your questionnaires to see compatibility insights!" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build question lookup map
    const questions_formatted = new Map<number, { question: string; options: Map<string, string> }>();
    for (const q of questionsData) {
      const options = new Map<string, string>();
      const optsArray = q.options as { value: string; label: string }[] | null;
      if (optsArray && Array.isArray(optsArray)) {
        for (const opt of optsArray) options.set(opt.value, opt.label);
      }
      questions_formatted.set(q.id, { question: q.question, options });
    }

    const formatAnswers = (answers: any[]) => {
      return answers.map(a => {
        // friendship_answers uses question_id as the lookup key; personality_answers uses question_number
        const lookupKey = isFriendship ? (a.question_id ?? a.question_number) : a.question_number;
        const qData = questions_formatted.get(lookupKey);
        const displayAnswer = a.answer_custom || a.answer || "";
        if (!qData) return `[Q${lookupKey}] [Unknown Question] [Answer: ${displayAnswer}]`;
        const alist = displayAnswer.split(',');
        const labels = alist.map((v: string) => qData.options.get(v.trim()) || v.trim()).filter(Boolean);
        return `[Question: ${qData.question}] [Answer: ${labels.join(', ')}]`;
      }).join('\n');
    };

    const user1Answers = formatAnswers(answers1);
    const user2Answers = formatAnswers(answers2);

    const { data: userName1, error: errorName1 } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId1);

    const { data: userName2, error: errorName2 } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId2);

    if (errorName1 || errorName2) {
      console.error('Error fetching names:', errorName1 || errorName2);
      throw new Error('Failed to fetch profile names');
    }

    // Call OpenAI to generate compatibility paragraph
    const openai = new OpenAI({
      apiKey: openAIApiKey,
    })

    const systemPrompt = isFriendship
      ? "You are a friendship compatibility expert. These two users are already confirmed as a great friendship match by the platform's matching engine. Generate a warm, insightful, encouraging paragraph (2-3 sentences) explaining why they could become great friends. Focus on shared interests, compatible social styles, and what they're both looking for in a friendship. Do NOT mention dating or romance. Keep wording positive, specific, and concise."
      : "You are a dating compatibility expert. These two users are already confirmed as an eligible match by the product's matching engine. Generate a warm, insightful, encouraging paragraph (2-3 sentences) explaining why they may connect. Focus on shared values, complementary traits, and communication style. Do NOT question their eligibility, orientation, or whether they should be matched. Do NOT introduce disqualifying caveats like attraction mismatch or compatibility blockers. Keep wording positive, specific, and concise.";

    const response = await openai.chat.completions.create({
      model: "gpt-5-nano-2025-08-07",
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate a compatibility insight based on these questionnaire answers:\n\nUser 1 (${userName1[0]["first_name"]}):\n${user1Answers}\n\nUser 2 (${userName2[0]["first_name"]}):\n${user2Answers}`
        }
      ]
    });

    // Errors handled by try-catch block hopefully lmao
    // if (!response.ok) {
    //   const errorText = await aiResponse.text();
    //   console.error('AI API error:', aiResponse.status, errorText);

    //   if (aiResponse.status === 429) {
    //     throw new Error('Rate limit exceeded. Please try again later.');
    //   }
    //   if (aiResponse.status === 402) {
    //     throw new Error('AI service unavailable. Please contact support.');
    //   }
    //   throw new Error('Failed to generate compatibility text');
    // }

    const compatibility = response.choices[0].message.content || "You both have interesting profiles that could lead to a great connection!";

    console.log('Generated compatibility:', compatibility);

    // Save the generated compatibility to database
    const { error: insertError } = await supabase
      .from('compatibility_insights')
      .upsert({
        user1_id: smallerId,
        user2_id: largerId,
        compatibility_text: compatibility
      }, {
        onConflict: 'user1_id,user2_id'
      });

    if (insertError) {
      console.error('Error saving compatibility insight:', insertError);
      // Continue anyway, we still want to return the generated text
    } else {
      console.log('Compatibility insight saved to database');
    }

    return new Response(
      JSON.stringify({ compatibility }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-compatibility function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
