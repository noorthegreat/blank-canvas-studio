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
    const { target_user_id, new_email } = await req.json();

    if (!target_user_id || !new_email) {
      throw new Error("Missing required fields: target_user_id, new_email");
    }

    // Verify the user calling this edge function is an admin
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: currentUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !currentUser) {
      throw new Error("Unauthorized");
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

    // Check if current user is an admin
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: currentUser.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      throw new Error("Forbidden: User does not have admin privileges");
    }

    // Proceed to update the target user's email
    const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      target_user_id,
      { email: new_email, email_confirm: true }
    );

    if (updateError) {
      throw new Error(`Failed to update user email: ${updateError.message}`);
    }

    // Also update the email on their profile record
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ email: new_email })
      .eq('id', target_user_id);

    if (profileUpdateError) {
      // Non-fatal, but worth logging
      console.error(`Failed to update profile email for ${target_user_id}: ${profileUpdateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email updated successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in update-user-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
