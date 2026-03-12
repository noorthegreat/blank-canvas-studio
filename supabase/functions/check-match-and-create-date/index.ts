/*
Function that runs when someone likes a match whose already liked them back.
We do this server side for added security.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authenticateEdgeRequest } from "../_shared/auth.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const WEEKLY_DROP_UTC_DAY = 1; // Monday
const WEEKLY_DROP_UTC_HOUR = 8; // 08:00 UTC

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function getDateWindowStartFromWeeklyDrop(now: Date): string {
    // If we're inside Monday's decision window (08:00-24:00 UTC), use this week's drop.
    // Otherwise, anchor to the next Monday drop.
    const isMonday = now.getUTCDay() === WEEKLY_DROP_UTC_DAY;
    const isInDecisionWindow = isMonday && now.getUTCHours() >= WEEKLY_DROP_UTC_HOUR;

    const daysUntilMonday = (WEEKLY_DROP_UTC_DAY - now.getUTCDay() + 7) % 7;
    let nextMondayDrop = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + daysUntilMonday,
        WEEKLY_DROP_UTC_HOUR,
        0,
        0,
        0
    );

    if (now.getTime() >= nextMondayDrop) {
        nextMondayDrop += WEEK_MS;
    }

    const activeDropMs = isInDecisionWindow ? (nextMondayDrop - WEEK_MS) : nextMondayDrop;

    // Scheduling window starts on Tuesday 07:00 UI time; first_possible_day stores the day anchor.
    const firstPossibleDay = new Date(activeDropMs + DAY_MS);
    return firstPossibleDay.toISOString().split("T")[0];
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const auth = await authenticateEdgeRequest(req, {
            allowCronSecret: true,
            allowServiceRole: true,
        });
        if (auth.error) {
            return new Response(JSON.stringify({ error: auth.error.message }), {
                status: auth.error.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const supabase = auth.context!.supabase;

        const { userId, matchedUserId, email_both } = await req.json();

        if (!userId || !matchedUserId) {
            throw new Error("Missing userId or matchedUserId");
        }

        if (!auth.context!.isInternal && !auth.context!.isAdmin && auth.context!.user?.id !== userId) {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 1. Mutual like check
        const { data: likeData, error: likeError } = await supabase
            .from("likes")
            .select("id")
            .eq("user_id", matchedUserId)
            .eq("liked_user_id", userId)
            .maybeSingle();

        if (likeError) throw likeError;

        const { data: otherLikeData, error: otherLikeError } = await supabase
            .from("likes")
            .select("id")
            .eq("user_id", userId)
            .eq("liked_user_id", matchedUserId)
            .maybeSingle();

        if (otherLikeError) throw otherLikeError;

        if (!otherLikeData || !likeData) {
            return new Response(
                JSON.stringify({ matched: false, message: "Not a mutual like yet" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { error: resetCounterError } = await supabase
            .from("unanswered_like_rematch_counts")
            .upsert([
                {
                    user_id: userId,
                    matched_user_id: matchedUserId,
                    match_type: "relationship",
                    unanswered_like_count: 0,
                    updated_at: new Date().toISOString(),
                },
                {
                    user_id: matchedUserId,
                    matched_user_id: userId,
                    match_type: "relationship",
                    unanswered_like_count: 0,
                    updated_at: new Date().toISOString(),
                },
            ], { onConflict: "user_id,matched_user_id,match_type" });

        if (resetCounterError) {
            console.error("Failed to reset unanswered like rematch counters:", resetCounterError);
        }

        // 2. Check if a date already exists
        const { data: existingDate, error: dateError } = await supabase
            .from("dates")
            .select("id")
            .or(`and(user1_id.eq.${userId},user2_id.eq.${matchedUserId}),and(user1_id.eq.${matchedUserId},user2_id.eq.${userId})`)
            .maybeSingle();

        if (dateError) throw dateError;

        if (existingDate) {
            return new Response(
                JSON.stringify({ matched: true, dateId: existingDate.id, message: "Date already exists" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Create a new date
        const now = new Date();
        const firstPossibleDay = getDateWindowStartFromWeeklyDrop(now);

        // --- Venue Selection Logic ---
        let venueOptions: string[] | null = null;
        let selectedTimezone: string | null = null;

        try {
            // Fetch users' locations
            const { data: userData, error: userError } = await supabase
                .from("profiles")
                .select("latitude, longitude")
                .in("id", [userId, matchedUserId]);

            if (userError) throw userError;

            const validLocations = userData?.filter((u: any) => u.latitude !== null && u.longitude !== null);

            if (validLocations && validLocations.length === 2) {
                const lat1 = validLocations[0].latitude;
                const lon1 = validLocations[0].longitude;
                const lat2 = validLocations[1].latitude;
                const lon2 = validLocations[1].longitude;

                // Simple midpoint calculation (sufficient for local dates)
                const midLat = (lat1 + lat2) / 2;
                const midLon = (lon1 + lon2) / 2;

                console.log(`Midpoint calculated at: ${midLat}, ${midLon}`);

                // Fetch all venues
                const { data: venues, error: venuesError } = await supabase
                    .from("venues")
                    .select("id, type, latitude, longitude, timezone");

                if (venuesError) throw venuesError;

                if (venues && venues.length > 0) {
                    // Find closest Coffee Shop
                    const coffeeShops = venues.filter((v: any) => v.type === 'coffee' && v.latitude && v.longitude);
                    let closestCoffee = null;
                    let minCoffeeDist = Infinity;

                    for (const shop of coffeeShops) {
                        const dist = calculateDistance(midLat, midLon, shop.latitude, shop.longitude);
                        if (dist < minCoffeeDist) {
                            minCoffeeDist = dist;
                            closestCoffee = shop;
                        }
                    }

                    // Find closest Bar
                    const bars = venues.filter((v: any) => v.type === 'bar' && v.latitude && v.longitude);
                    let closestBar = null;
                    let minBarDist = Infinity;

                    for (const bar of bars) {
                        const dist = calculateDistance(midLat, midLon, bar.latitude, bar.longitude);
                        if (dist < minBarDist) {
                            minBarDist = dist;
                            closestBar = bar;
                        }
                    }

                    // Prefer coffee shop timezone, or just take the first one found
                    const options = [];
                    if (closestCoffee) {
                        options.push(closestCoffee.id);
                        if (!selectedTimezone && closestCoffee.timezone) selectedTimezone = closestCoffee.timezone;
                    }
                    if (closestBar) {
                        options.push(closestBar.id);
                        if (!selectedTimezone && closestBar.timezone) selectedTimezone = closestBar.timezone;
                    }

                    if (options.length > 0) {
                        venueOptions = options;
                        console.log("Selected venue options:", venueOptions);
                    }
                }
            } else {
                console.log("Users missing location data, skipping smart venue selection.");
            }
        } catch (err) {
            console.error("Error selecting venues:", err);
            // Don't fail the whole request, just proceed without options
        }
        const { data: newDate, error: createError } = await supabase
            .from("dates")
            .insert({
                user1_id: userId,
                user2_id: matchedUserId,
                first_possible_day: firstPossibleDay,
                venue_options: venueOptions,
                timezone: selectedTimezone
            })
            .select("id")
            .single();

        if (createError) throw createError;

        // 4. Send email to the OTHER user (matchedUserId)
        // The current user (userId) sees the popup, so they don't need an email immediately (or maybe they do, but per requirements: "doesn't need to email both as one user already got the popup notification")

        // Fetch user names for the email
        const { data: userProfile } = await supabase.from("profiles").select("first_name").eq("id", userId).single();
        const { data: matchedUserProfile } = await supabase.from("profiles").select("first_name").eq("id", matchedUserId).single();

        if (userProfile && matchedUserProfile) {
            console.log("Match created, sending email to ", matchedUserId)
            await supabase.functions.invoke("send-user-emails", {
                headers: {
                    "X-Cron-Secret": Deno.env.get("CRON_SECRET") || ""
                },
                body: {
                    emailType: "new_date",
                    recipients: [
                        {
                            userId: matchedUserId,
                            customData: {
                                partnerName: userProfile.first_name,
                                firstDay: firstPossibleDay
                            }
                        },
                        ...(email_both ? [{
                            userId: userId,
                            customData: {
                                partnerName: matchedUserProfile.first_name,
                                firstDay: firstPossibleDay
                            }
                        }] : [])
                    ]
                }
            });
        }

        return new Response(
            JSON.stringify({ matched: true, dateId: newDate.id, message: "Date created!" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}
