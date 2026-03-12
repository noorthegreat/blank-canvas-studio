/*
Delete the account that invokes this function.
Done server-side because doing it client-side might be fuckey? idk. it just felt right.
*/

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get the user from the request authorization header
        const authHeader = req.headers.get("Authorization")!;
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Processing deletion request from user ${user.id}`);

        let targetUserId = user.id;

        // Check if a target user ID was provided in the body
        let bodyText = "";
        try {
            bodyText = await req.text();
        } catch (readError) {
            console.error("Error reading request body:", readError);
            return new Response(
                JSON.stringify({ error: "Failed to read request body" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (bodyText && bodyText.trim().length > 0) {
            try {
                const body = JSON.parse(bodyText);
                if (body && body.target_user_id) {
                    // Check if the requester is an admin
                    const { data: hasAdminRole } = await supabase.rpc('has_role', {
                        _user_id: user.id,
                        _role: 'admin'
                    });

                    if (hasAdminRole) {
                        // Prevent admin from accidentally deleting themselves via this path without explicit confirmation if needed,
                        // though the logic below handles targetUserId.
                        if (body.target_user_id === user.id) {
                            console.log(`Admin ${user.id} is requesting self-deletion via target_user_id param.`);
                            // Validate intent if necessary, but for now we allow it as it is explicit.
                        }
                        targetUserId = body.target_user_id;
                        console.log(`Admin ${user.id} is deleting user ${targetUserId}`);
                    } else {
                        console.warn(`User ${user.id} attempted to delete ${body.target_user_id} without admin privileges`);
                        return new Response(
                            JSON.stringify({ error: "Unauthorized: Admin privileges required to delete other users." }),
                            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        );
                    }
                }
            } catch (jsonError) {
                console.error("Invalid JSON in request body:", jsonError);
                return new Response(
                    JSON.stringify({ error: "Invalid JSON body. usage: { \"target_user_id\": \"uuid\" } or empty body for self-deletion." }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }
        // If body is empty, we fall through to using `targetUserId = user.id` (initialized above)

        console.log(`Processing deletion for user ${targetUserId}`);

        // 1. Fetch active dates to notify partners
        // We use the service role client (supabase) which bypasses RLS, so we can see all dates
        const { data: activeDates, error: datesError } = await supabase
            .from('dates')
            .select('user1_id, user2_id')
            .or(`user1_id.eq.${targetUserId},user2_id.eq.${targetUserId}`)
            .in('status', ['pending', 'confirmed']);

        if (datesError) {
            console.error("Error fetching dates:", datesError);
            // We continue with deletion even if this fails, but log it
        }

        let activePartnerIds: string[] = [];

        if (activeDates && activeDates.length > 0) {
            console.log(`Found ${activeDates.length} active dates to notify`);
            const recipients = activeDates.map(d => ({
                userId: d.user1_id === targetUserId ? d.user2_id : d.user1_id
            }));

            activePartnerIds = recipients.map((r: { userId: string }) => r.userId);

            // 2. Send cancellation emails via send-user-emails function
            try {

                const { error: invokeError } = await supabase.functions.invoke("send-user-emails", {
                    body: {
                        emailType: 'match_cancelled',
                        recipients
                    }
                });

                if (invokeError) {
                    console.error(`Failed to send emails:`, invokeError);
                } else {
                    console.log("Cancellation emails sent successfully");
                }
            } catch (emailError) {
                console.error("Error invoking send-user-emails:", emailError);
            }
        }

        // 3. Record the deletion in deleted_users table
        const { error: recordError } = await supabase
            .from('deleted_users')
            .insert({
                user_id: targetUserId,
                user_created_at: user.created_at, // We might not have this easily if deleting another user, can leave null or fetch if strict
                reason: targetUserId === user.id ? "User self-deleted" : `Deleted by admin ${user.id}`,
                // deleted_at sets to now() by default
                active_date_partners: activePartnerIds.length > 0 ? activePartnerIds : null
            });

        if (recordError) {
            console.error("Error recording user deletion:", recordError);
            // We continue with deletion even if this fails, but log it
        }

        console.log(`Deleting user ${targetUserId} from auth`);

        // 3. Delete the user from auth.users
        const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);

        if (deleteError) {
            console.error(`Error deleting user ${targetUserId} from auth.users:`, deleteError);
            console.error("Full error object:", JSON.stringify(deleteError, null, 2));
            throw deleteError;
        }

        return new Response(
            JSON.stringify({ message: "User deleted successfully" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("Error in delete-account function:", error);

        // Return more specific error info if available, but be careful not to leak checks if unauthorized
        const status = error.status || 500;
        const message = error.message || "Internal Server Error";

        return new Response(
            JSON.stringify({
                error: message,
                details: error
            }),
            { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
