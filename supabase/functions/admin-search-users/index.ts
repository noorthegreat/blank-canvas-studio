// For the admin panel, search for users
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
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { query } = await req.json();

        if (!query) {
            return new Response(
                JSON.stringify({ users: [] }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);

        let matchingIds = new Set<string>();

        if (isUuid) {
            matchingIds.add(query);
        } else {
            // Search profiles by first_name
            const { data: profileMatches } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .ilike('first_name', `%${query}%`)
                .limit(50);

            (profileMatches || []).forEach((r: any) => matchingIds.add(r.id));

            // Search private_profile_data by last_name or email (service_role bypasses RLS)
            const { data: privateMatches } = await supabaseAdmin
                .from('private_profile_data')
                .select('user_id')
                .or(`last_name.ilike.%${query}%,email.ilike.%${query}%`)
                .limit(50);

            (privateMatches || []).forEach((r: any) => matchingIds.add(r.user_id));
        }

        if (matchingIds.size === 0) {
            return new Response(
                JSON.stringify({ users: [] }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const ids = Array.from(matchingIds);

        const [{ data: profilesData }, { data: privateData }] = await Promise.all([
            supabaseAdmin.from('profiles').select('*').in('id', ids),
            supabaseAdmin.from('private_profile_data').select('*').in('user_id', ids),
        ]);

        const privateByUser = new Map((privateData || []).map((r: any) => [r.user_id, r]));
        const users = (profilesData || []).map((p: any) => ({
            ...p,
            ...(privateByUser.get(p.id) || {}),
        }));

        return new Response(
            JSON.stringify({ users }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
