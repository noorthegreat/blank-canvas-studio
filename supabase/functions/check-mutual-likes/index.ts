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
    return new Date(activeDropMs + DAY_MS).toISOString().split("T")[0];
}

// Console log wrapper to prevent "console is not defined" errors in some edge environments (though Deno usually supports it)
const log = (msg: string, data?: any) => console.log(`[CheckMutualLikes] ${msg}`, data || "");
const errorLog = (msg: string, err?: any) => console.error(`[CheckMutualLikes] ERROR: ${msg}`, err || "");

interface Action {
    type: 'create_date' | 'cancel_date';
    description: string;
    details: any;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const auth = await authenticateEdgeRequest(req, { allowCronSecret: true });
        if (auth.error) {
            return new Response(JSON.stringify({ error: auth.error.message }), {
                status: auth.error.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        if (!auth.context!.isInternal && !auth.context!.isAdmin) {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const supabase = auth.context!.supabase;

        let body: any = {};
        try {
            const text = await req.text();
            if (text) body = JSON.parse(text);
        } catch (e) {
            // Body might be empty
        }

        let dryRun = true;
        if (body.dry_run === false) dryRun = false;

        log(`Starting check... Dry Run: ${dryRun}`);

        const actions: Action[] = [];
        let datesCreated = 0;
        let datesCancelled = 0;

        // ==========================================
        // PART 1: Check Mutual Likes -> Create Date
        // ==========================================

        const { data: allLikes, error: likesError } = await supabase
            .from("likes")
            .select("user_id, liked_user_id, created_at");

        if (likesError) throw likesError;

        const likeMap = new Map<string, Set<string>>();
        if (allLikes) {
            for (const l of allLikes) {
                if (!likeMap.has(l.user_id)) likeMap.set(l.user_id, new Set());
                likeMap.get(l.user_id)?.add(l.liked_user_id);
            }
        }

        const mutualMatches: { u1: string, u2: string }[] = [];
        const processedPairs = new Set<string>();

        if (allLikes) {
            for (const l of allLikes) {
                const u1 = l.user_id;
                const u2 = l.liked_user_id;

                const pairKey = [u1, u2].sort().join(":");
                if (processedPairs.has(pairKey)) continue;

                if (likeMap.get(u2)?.has(u1)) {
                    mutualMatches.push({ u1, u2 });
                    processedPairs.add(pairKey);
                }
            }
        }

        log(`Found ${mutualMatches.length} mutual match pairs.`);

        for (const pair of mutualMatches) {
            const { data: existingDate } = await supabase
                .from("dates")
                .select("id")
                .or(`and(user1_id.eq.${pair.u1},user2_id.eq.${pair.u2}),and(user1_id.eq.${pair.u2},user2_id.eq.${pair.u1})`)
                .maybeSingle();

            if (!existingDate) {
                // Fetch names for better reporting
                const [{ data: u1Profile }, { data: u1Private }] = await Promise.all([
                    supabase.from("profiles").select("first_name").eq("id", pair.u1).single(),
                    supabase.from("private_profile_data").select("last_name, email").eq("user_id", pair.u1).single(),
                ]);
                const [{ data: u2Profile }, { data: u2Private }] = await Promise.all([
                    supabase.from("profiles").select("first_name").eq("id", pair.u2).single(),
                    supabase.from("private_profile_data").select("last_name, email").eq("user_id", pair.u2).single(),
                ]);
                // Merge private data for convenience
                const u1ProfileFull = u1Profile ? { ...u1Profile, ...u1Private } : null;
                const u2ProfileFull = u2Profile ? { ...u2Profile, ...u2Private } : null;

                if (!u1ProfileFull || !u2ProfileFull) {
                    log(`Skipping match ${pair.u1} <-> ${pair.u2}: One or both profiles not found.`);
                    continue;
                }

                const u1Name = `${u1ProfileFull.first_name} ${u1ProfileFull.last_name ?? ""}`.trim() || pair.u1;
                const u2Name = `${u2ProfileFull.first_name} ${u2ProfileFull.last_name ?? ""}`.trim() || pair.u2;

                log(`New Mutual Match found: ${u1Name} <-> ${u2Name}`);

                if (dryRun) {
                    actions.push({
                        type: 'create_date',
                        description: `Would create date for ${u1Name} and ${u2Name}`,
                        details: {
                            user1: { id: pair.u1, name: u1Name, email: u1ProfileFull?.email },
                            user2: { id: pair.u2, name: u2Name, email: u2ProfileFull?.email },
                            estimated_first_day: getDateWindowStartFromWeeklyDrop(new Date()),
                            emails_to_send: [u1ProfileFull?.email, u2ProfileFull?.email].filter(Boolean)
                        }
                    });
                } else {
                    log(`Creating date for pair: ${pair.u1} <-> ${pair.u2}`);
                    const { data: result, error: invokeError } = await supabase.functions.invoke('check-match-and-create-date', {
                        body: {
                            userId: pair.u1,
                            matchedUserId: pair.u2,
                            email_both: true
                        }
                    });

                    if (invokeError) throw new Error(`Failed to invoke creation params for ${pair.u1}-${pair.u2}: ${invokeError.message || invokeError}`);
                    if (result?.error) throw new Error(`Creation function returned error for ${pair.u1}-${pair.u2}: ${result.error}`);

                    if (result?.matched) {
                        datesCreated++;
                        log(`Date created successfully via invoke: ${result?.message}`);
                    }
                }
            }
        }

        // ==========================================
        // PART 2: Clean up Expired Dates
        // ==========================================

        log("Checking for expired dates...");

        // Expiration Logic: first_possible_day < now - 10 days
        const today = new Date();
        const cutoffDate = new Date();
        cutoffDate.setDate(today.getDate() - 10);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        const { data: expiredDates, error: expiredError } = await supabase
            .from("dates")
            .select("id, user1_id, user2_id, status, first_possible_day")
            .eq("status", "pending")
            .lt("first_possible_day", cutoffDateStr);

        if (expiredError) throw expiredError;

        log(`Found ${expiredDates?.length || 0} expired dates.`);

        if (expiredDates && expiredDates.length > 0) {
            for (const date of expiredDates) {
                const [{ data: p1 }, { data: p1Private }] = await Promise.all([
                    supabase.from("profiles").select("first_name").eq("id", date.user1_id).single(),
                    supabase.from("private_profile_data").select("email").eq("user_id", date.user1_id).single(),
                ]);
                const [{ data: p2 }, { data: p2Private }] = await Promise.all([
                    supabase.from("profiles").select("first_name").eq("id", date.user2_id).single(),
                    supabase.from("private_profile_data").select("email").eq("user_id", date.user2_id).single(),
                ]);

                if (dryRun) {
                    actions.push({
                        type: 'cancel_date',
                        description: `Would cancel expired date ${date.id} (Proposed: ${date.first_possible_day})`,
                        details: {
                            date_id: date.id,
                            user1: { id: date.user1_id, name: p1?.first_name, email: p1Private?.email },
                            user2: { id: date.user2_id, name: p2?.first_name, email: p2Private?.email },
                            reason: "Expired (over 10 days since first possible day)",
                            emails_to_send: [p1Private?.email, p2Private?.email].filter(Boolean)
                        }
                    });
                } else {
                    const autoCancelReason = "Auto cancelled: Expired pending date window (>10 days from first possible day)";
                    // 1. Cancel Date
                    const { error: updateError } = await supabase
                        .from("dates")
                        .update({
                            status: 'auto_cancelled',
                            user1_feedback: autoCancelReason,
                            user2_feedback: autoCancelReason
                        })
                        .eq("id", date.id);

                    if (updateError) throw new Error(`Failed to cancel date ${date.id}: ${updateError.message}`);

                    // 2. Delete Likes
                    const { error: deleteLikesError } = await supabase
                        .from("likes")
                        .delete()
                        .or(`and(user_id.eq.${date.user1_id},liked_user_id.eq.${date.user2_id}),and(user_id.eq.${date.user2_id},liked_user_id.eq.${date.user1_id})`);

                    if (deleteLikesError) throw new Error(`Failed to delete likes for date ${date.id}: ${deleteLikesError.message}`);

                    datesCancelled++;

                    // 3. Notify Users
                    if (p1 && p2) {
                        await supabase.functions.invoke("send-user-emails", {
                            headers: { "X-Cron-Secret": Deno.env.get("CRON_SECRET") || "" },
                            body: {
                                emailType: "auto-cancelled-date",
                                recipients: [
                                    { userId: date.user1_id, customData: { partnerName: p2.first_name } },
                                    { userId: date.user2_id, customData: { partnerName: p1.first_name } }
                                ]
                            }
                        });
                    }
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            dry_run: dryRun,
            datesCreated: dryRun ? 0 : datesCreated,
            datesCancelled: dryRun ? 0 : datesCancelled,
            actions: actions,
            message: dryRun
                ? `Dry Run: Found ${actions.length} potential actions.`
                : `Created ${datesCreated} dates, Cancelled ${datesCancelled} expired dates.`
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        errorLog("Internal Error", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
