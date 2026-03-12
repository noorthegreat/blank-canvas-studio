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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authData.user.id;

    const { data: hasAdminRole } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!hasAdminRole) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedCount = Number(body?.count ?? 5);
    const maxCount = Math.min(Math.max(requestedCount, 1), 5);

    const { data: roleRows, error: roleRowsError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["test", "admin"]);
    if (roleRowsError) throw roleRowsError;

    const eligibleRoleUserIds = Array.from(
      new Set((roleRows || []).map((r: { user_id: string }) => r.user_id)),
    ).filter((id) => id !== userId);

    if (eligibleRoleUserIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "No eligible test/admin users found. Create at least one additional test/admin user profile with completed questionnaire.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: candidateProfiles, error: candidatesError } = await supabase
      .from("profiles")
      .select("id")
      .in("id", eligibleRoleUserIds)
      .eq("completed_questionnaire", true)
      .neq("is_paused", true)
      .limit(maxCount);

    if (candidatesError) throw candidatesError;
    const candidateIds = (candidateProfiles || []).map((p: { id: string }) => p.id);
    if (candidateIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "No eligible test/admin users with completed questionnaire were found.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("matches")
      .delete()
      .or(
        candidateIds
          .map((id: string) => `and(user_id.eq.${userId},matched_user_id.eq.${id})`)
          .concat(candidateIds.map((id: string) => `and(user_id.eq.${id},matched_user_id.eq.${userId})`))
          .join(","),
      );

    const matchRows = candidateIds.flatMap((id: string, index: number) => [
      {
        user_id: userId,
        matched_user_id: id,
        compatibility_score: 99 - index,
        from_algorithm: "relationship",
        match_type: "relationship",
      },
      {
        user_id: id,
        matched_user_id: userId,
        compatibility_score: 99 - index,
        from_algorithm: "relationship",
        match_type: "relationship",
      },
    ]);

    const { error: insertMatchesError } = await supabase.from("matches").insert(matchRows);
    if (insertMatchesError) throw insertMatchesError;

    const primaryMatchedUserId = candidateIds[0];

    await supabase
      .from("likes")
      .delete()
      .or(
        `and(user_id.eq.${userId},liked_user_id.eq.${primaryMatchedUserId}),and(user_id.eq.${primaryMatchedUserId},liked_user_id.eq.${userId})`,
      );

    const { error: likesError } = await supabase.from("likes").insert([
      { user_id: userId, liked_user_id: primaryMatchedUserId },
      { user_id: primaryMatchedUserId, liked_user_id: userId },
    ]);
    if (likesError) throw likesError;

    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
    const dateTimeIso = tenMinutesFromNow.toISOString();
    const firstPossibleDay = dateTimeIso.slice(0, 10);
    const allSlots = Array.from({ length: 48 }, (_, i) => i);
    const fullWeekAvailability = Object.fromEntries(
      Array.from({ length: 7 }, (_, day) => [String(day), allSlots]),
    );

    const { data: existingDate } = await supabase
      .from("dates")
      .select("id")
      .or(
        `and(user1_id.eq.${userId},user2_id.eq.${primaryMatchedUserId}),and(user1_id.eq.${primaryMatchedUserId},user2_id.eq.${userId})`,
      )
      .maybeSingle();

    let dateId: string;
    if (existingDate?.id) {
      dateId = existingDate.id;
      const { error: updateDateError } = await supabase
        .from("dates")
        .update({
          user1_availability: fullWeekAvailability as any,
          user2_availability: fullWeekAvailability as any,
          user1_confirmed: true,
          user2_confirmed: true,
          status: "confirmed",
          date_time: dateTimeIso,
          first_possible_day: firstPossibleDay,
          timezone: "Europe/Zurich",
        })
        .eq("id", dateId);
      if (updateDateError) throw updateDateError;
    } else {
      const { data: newDate, error: createDateError } = await supabase
        .from("dates")
        .insert({
          user1_id: userId,
          user2_id: primaryMatchedUserId,
          user1_availability: fullWeekAvailability as any,
          user2_availability: fullWeekAvailability as any,
          user1_confirmed: true,
          user2_confirmed: true,
          status: "confirmed",
          date_time: dateTimeIso,
          first_possible_day: firstPossibleDay,
          timezone: "Europe/Zurich",
        })
        .select("id")
        .single();
      if (createDateError || !newDate) throw createDateError;
      dateId = newDate.id;
    }

    return new Response(
      JSON.stringify({
        success: true,
        matchesCreated: candidateIds.length,
        primaryMatchedUserId,
        dateId,
        dateTime: dateTimeIso,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
