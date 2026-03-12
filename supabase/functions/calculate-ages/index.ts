/*
Function that you can invoke whenever you want to recalculate the ages of every user.
Was created when we had a bunch of users with birthdays but no age field, and we needed to backfill that data.
Nowadays the age field is calculated automatically, so this function shouldn't really be needed.
*/
import { authenticateEdgeRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticateEdgeRequest(req, { requireAdmin: true });
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error.message }), {
        status: auth.error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = auth.context!.supabase;

    console.log("Starting age calculation for all users...");

    // Fetch all private_profile_data rows with birthdays
    const { data: profiles, error: fetchError } = await supabaseClient
      .from("private_profile_data")
      .select("user_id, birthday")
      .not("birthday", "is", null);

    if (fetchError) {
      console.error("Error fetching profiles:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${profiles?.length || 0} profiles with birthdays`);

    let updated = 0;
    let skipped = 0;

    // Calculate and update ages
    for (const profile of profiles || []) {
      if (!profile.birthday) {
        skipped++;
        continue;
      }

      // Parse birthday (format: YYYY-MM-DD)
      const birthDate = new Date(profile.birthday);
      const today = new Date();

      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      // Adjust age if birthday hasn't occurred yet this year
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // Update the profile with calculated age
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ age })
        .eq("id", profile.user_id);

      if (updateError) {
        console.error(`Error updating profile ${profile.user_id}:`, updateError);
      } else {
        updated++;
        console.log(`Updated profile ${profile.user_id}: age = ${age}`);
      }
    }

    const result = {
      success: true,
      total: profiles?.length || 0,
      updated,
      skipped,
      message: `Successfully updated ${updated} profiles, skipped ${skipped}`,
    };

    console.log("Age calculation completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in calculate-ages function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
