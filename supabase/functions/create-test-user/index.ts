// Setup for creating a test user with replicated data
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { email, password, admin_user_id } = await req.json();

        if (!email || !admin_user_id) {
            throw new Error("Missing required fields: email, admin_user_id");
        }

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                }
            }
        );

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { data: hasAdminRole, error: roleError } = await supabaseAdmin.rpc("has_role", {
            _user_id: user.id,
            _role: "admin",
        });
        if (roleError || !hasAdminRole) {
            return new Response(
                JSON.stringify({ error: "Forbidden" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (admin_user_id !== user.id) {
            return new Response(
                JSON.stringify({ error: "admin_user_id must match the authenticated admin" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 1. Fetch Admin Data
        const [{ data: adminProfile, error: profileError }, { data: adminPrivateData }] = await Promise.all([
            supabaseAdmin.from('profiles').select('*').eq('id', admin_user_id).single(),
            supabaseAdmin.from('private_profile_data').select('*').eq('user_id', admin_user_id).single(),
        ]);

        if (profileError) throw new Error(`Error fetching admin profile: ${profileError.message}`);

        const { data: adminAnswers, error: answersError } = await supabaseAdmin
            .from('personality_answers')
            .select('*')
            .eq('user_id', admin_user_id);

        if (answersError) throw new Error(`Error fetching admin answers: ${answersError.message}`);

        // 2. Create New User
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: password || 'password',
            email_confirm: true,
            user_metadata: {
                first_name: "(TEST) " + adminProfile.first_name,
                last_name: adminPrivateData?.last_name,
            }
        });

        if (createError) throw new Error(`Error creating user: ${createError.message}`);
        const newUserId = userData.user.id;

        // 3. Assign 'test' role
        const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
                user_id: newUserId,
                role: 'test'
            });

        if (roleError) throw new Error(`Error assigning role: ${roleError.message}`);

        // 4. Upsert Profile Data (Remove unique fields like ID, keep others)
        const { id, updated_at, created_at, ...profileData } = adminProfile;

        // Note: triggered user creation might have already created a basic profile.
        // We use upsert to overwrite or insert.
        const { error: updateProfileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: newUserId,
                ...profileData,
                first_name: "(TEST USER) " + adminProfile.first_name,
                is_paused: true,
            });

        if (updateProfileError) throw new Error(`Error updating profile: ${updateProfileError.message}`);

        // Also copy private profile data for the test user
        if (adminPrivateData) {
            const { user_id: _uid, created_at: _ca, updated_at: _ua, ...privateData } = adminPrivateData;
            await supabaseAdmin.from('private_profile_data').upsert({
                user_id: newUserId,
                ...privateData,
                email, // Use the new email
            });
        }

        // 5. Insert Personality Answers
        if (adminAnswers && adminAnswers.length > 0) {
            const newAnswers = adminAnswers.map((ans: any) => ({
                user_id: newUserId,
                question_number: ans.question_number,
                answer: ans.answer,
                answer_custom: ans.answer_custom,
                question_id: ans.question_id
            }));

            const { error: answersInsertError } = await supabaseAdmin
                .from('personality_answers')
                .insert(newAnswers);

            if (answersInsertError) throw new Error(`Error inserting answers: ${answersInsertError.message}`);
        }

        // 5b. Insert Friendship Answers
        const { data: adminFriendshipAnswers, error: friendshipAnswersError } = await supabaseAdmin
            .from('friendship_answers')
            .select('*')
            .eq('user_id', admin_user_id);

        if (friendshipAnswersError) throw new Error(`Error fetching admin friendship answers: ${friendshipAnswersError.message}`);

        if (adminFriendshipAnswers && adminFriendshipAnswers.length > 0) {
            const newFriendshipAnswers = adminFriendshipAnswers.map((ans: any) => ({
                user_id: newUserId,
                question_number: ans.question_number,
                answer: ans.answer,
                answer_custom: ans.answer_custom,
                question_id: ans.question_id
            }));

            const { error: friendshipInsertError } = await supabaseAdmin
                .from('friendship_answers')
                .insert(newFriendshipAnswers);

            if (friendshipInsertError) throw new Error(`Error inserting friendship answers: ${friendshipInsertError.message}`);
        }

        // 5c. Insert Event Enrollments
        const { data: adminEnrollments, error: enrollmentsError } = await supabaseAdmin
            .from('event_enrollments')
            .select('*')
            .eq('user_id', admin_user_id);

        if (enrollmentsError) throw new Error(`Error fetching admin enrollments: ${enrollmentsError.message}`);

        if (adminEnrollments && adminEnrollments.length > 0) {
            const newEnrollments = adminEnrollments.map((enr: any) => ({
                user_id: newUserId,
                event_name: enr.event_name
            }));

            const { error: enrollmentsInsertError } = await supabaseAdmin
                .from('event_enrollments')
                .insert(newEnrollments);

            if (enrollmentsInsertError) throw new Error(`Error inserting event enrollments: ${enrollmentsInsertError.message}`);
        }

        // 6. Create Match with Admin
        // Check if match already exists (unlikely for new user, but good practice)
        // Just insert.
        const matches = [
            {
                user_id: admin_user_id,
                matched_user_id: newUserId,
                compatibility_score: 95
            },
            {
                user_id: newUserId,
                matched_user_id: admin_user_id,
                compatibility_score: 95
            }
        ];

        const { error: matchError } = await supabaseAdmin
            .from('matches')
            .insert(matches);

        if (matchError) throw new Error(`Error creating match: ${matchError.message}`);

        // 7. Create Like from Test User to Admin
        const { error: likeError } = await supabaseAdmin
            .from('likes')
            .insert({
                user_id: newUserId,
                liked_user_id: admin_user_id
            });

        if (likeError) throw new Error(`Error creating like: ${likeError.message}`);

        return new Response(
            JSON.stringify({ success: true, user: userData.user }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
