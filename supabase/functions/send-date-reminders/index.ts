
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authenticateEdgeRequest } from "../_shared/auth.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
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
        const internalHeaders = { "X-Cron-Secret": Deno.env.get("CRON_SECRET") ?? "" };

        // Parse request body for dryRun flag.
        // Default is REAL run so scheduled automation actually sends reminders.
        let dryRun = false;
        try {
            const body = await req.json();
            if (typeof body.dryRun === 'boolean') {
                dryRun = body.dryRun;
            }
        } catch {
            // Body parsing failed (e.g. GET request), keep default (real run).
        }

        const now = new Date();
        console.log(`Running date reminders check at ${now.toISOString()} (Dry Run: ${dryRun})`);

        // Need to select confirmed dates where reminders haven't been sent.
        // Ideally we filter by date_time range in the DB query for efficiency.
        // 24h window: 23 hours to 25 hours from now.
        // 1h window: 0.5 hours to 1.5 hours from now.

        // Calculate timestamp bounds
        const hourMs = 60 * 60 * 1000;

        const time24hStart = new Date(now.getTime() + (23 * hourMs)).toISOString();
        const time24hEnd = new Date(now.getTime() + (25 * hourMs)).toISOString();

        const time1hStart = new Date(now.getTime() + (0.5 * hourMs)).toISOString();
        const time1hEnd = new Date(now.getTime() + (1.5 * hourMs)).toISOString();

        // Query 1: 24h reminders
        // status='confirmed', reminder_24h_sent=false, date_time between time24hStart and time24hEnd
        const { data: dates24h, error: error24h } = await supabase
            .from("dates")
            .select(`
            *,
            user1:profiles!dates_user1_id_fkey1(id, first_name),
            user2:profiles!dates_user2_id_fkey1(id, first_name)
        `)
            .eq("status", "confirmed")
            .eq("reminder_24h_sent", false)
            .gte("date_time", time24hStart)
            .lte("date_time", time24hEnd);

        if (error24h) throw new Error(`Error fetching 24h dates: ${error24h.message}`);

        // Query 2: 1h reminders
        // status='confirmed', reminder_1h_sent=false, date_time between time1hStart and time1hEnd
        const { data: dates1h, error: error1h } = await supabase
            .from("dates")
            .select(`
            *,
            user1:profiles!dates_user1_id_fkey1(id, first_name),
            user2:profiles!dates_user2_id_fkey1(id, first_name)
        `)
            .eq("status", "confirmed")
            .eq("reminder_1h_sent", false)
            .gte("date_time", time1hStart)
            .lte("date_time", time1hEnd);

        if (error1h) throw new Error(`Error fetching 1h dates: ${error1h.message}`);

        // Fetch phone numbers from private_profile_data for 1h reminder users (service_role bypasses RLS)
        const dates1hUserIds = new Set<string>();
        (dates1h || []).forEach((d: any) => {
            if (d.user1_id) dates1hUserIds.add(d.user1_id);
            if (d.user2_id) dates1hUserIds.add(d.user2_id);
        });
        const { data: privatePhoneRows } = dates1hUserIds.size > 0
            ? await supabase.from("private_profile_data").select("user_id, phone_number").in("user_id", Array.from(dates1hUserIds))
            : { data: [] };
        const phoneByUser = new Map((privatePhoneRows || []).map((r: any) => [r.user_id, r.phone_number]));

        // Query 3: Planning Reminder (48h after creation)
        const time48hAgo = new Date(now.getTime() - (48 * hourMs));
        const time7DaysAgo = new Date(now.getTime() - (14 * 24 * hourMs));

        // We can filter by created_at range.
        const { data: datesPlanning48h, error: errorPlan48h } = await supabase
            .from("dates")
            .select(`
            *,
            user1:profiles!dates_user1_id_fkey1(id, first_name),
            user2:profiles!dates_user2_id_fkey1(id, first_name)
        `)
            .eq("status", "pending")
            .eq("reminder_planning_48h_sent", false)
            .lte("created_at", time48hAgo.toISOString())
            .gte("created_at", time7DaysAgo.toISOString());

        if (errorPlan48h) throw new Error(`Error fetching planning 48h dates: ${errorPlan48h.message}`);

        // Query 4: Planning Reminder Soon (24h before first_possible_day)
        // first_possible_day is a YYYY-MM-DD string.
        // We want to send this reminder when 'tomorrow' matches 'first_possible_day'.
        const tomorrow = new Date(now.getTime() + (24 * hourMs));
        const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'UTC' }); // YYYY-MM-DD format

        const { data: datesPlanningSoon, error: errorPlanSoon } = await supabase
            .from("dates")
            .select(`
            *,
            user1:profiles!dates_user1_id_fkey1(id, first_name),
            user2:profiles!dates_user2_id_fkey1(id, first_name)
        `)
            .eq("status", "pending")
            .eq("reminder_planning_soon_sent", false)
            .eq("first_possible_day", tomorrowStr);

        if (errorPlanSoon) throw new Error(`Error fetching planning soon dates: ${errorPlanSoon.message}`);

        const allRecipients24h: any[] = [];
        const allRecipients1h: any[] = [];
        const allRecipientsPlan48h: any[] = [];
        const allRecipientsPlanSoon: any[] = [];

        const datesToUpdate24h: string[] = [];
        const datesToUpdate1h: string[] = [];
        const datesToUpdatePlan48h: string[] = [];
        const datesToUpdatePlanSoon: string[] = [];

        // Process 24h Reminders
        if (dates24h && dates24h.length > 0) {
            console.log(`Found ${dates24h.length} dates for 24h reminders`);

            for (const date of dates24h) {
                // Verify date object
                if (!date.user1 || !date.user2) {
                    console.error(`Missing profile data for date ${date.id}`);
                    continue;
                }

                const dateObj = new Date(date.date_time);
                const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: date.timezone || 'UTC' });
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: date.timezone || 'UTC' });
                const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: date.timezone || 'UTC' });

                const dateDetails = {
                    date: dateStr,
                    weekday: weekday,
                    time: timeStr,
                    locationName: date.location,
                    locationAddress: date.address
                };

                // User 1
                allRecipients24h.push({
                    userId: date.user1_id,
                    customData: {
                        partnerName: date.user2.first_name,
                        dateDetails
                    }
                });

                // User 2
                allRecipients24h.push({
                    userId: date.user2_id,
                    customData: {
                        partnerName: date.user1.first_name,
                        dateDetails
                    }
                });

                datesToUpdate24h.push(date.id);
            }
        }

        // Process 1h Reminders
        if (dates1h && dates1h.length > 0) {
            console.log(`Found ${dates1h.length} dates for 1h reminders`);

            for (const date of dates1h) {
                if (!date.user1 || !date.user2) {
                    console.error(`Missing profile data for date ${date.id}`);
                    continue;
                }

                const dateObj = new Date(date.date_time);
                const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: date.timezone || 'UTC' });
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: date.timezone || 'UTC' });
                const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: date.timezone || 'UTC' });

                const dateDetails = {
                    date: dateStr,
                    weekday: weekday,
                    time: timeStr,
                    locationName: date.location,
                    locationAddress: date.address
                };

                // Logic for sharing phone numbers
                // If user1_share_phone is true, user2 gets user1's phone
                // If user2_share_phone is true, user1 gets user2's phone

                const user1Phone = (date.user1_share_phone && phoneByUser.get(date.user1_id)) ? phoneByUser.get(date.user1_id) : "Not shared";
                const user2Phone = (date.user2_share_phone && phoneByUser.get(date.user2_id)) ? phoneByUser.get(date.user2_id) : "Not shared";

                // Send to User 1 (needs partner's phone i.e. user2Phone)
                allRecipients1h.push({
                    userId: date.user1_id,
                    customData: {
                        partnerName: date.user2.first_name,
                        partnerPhone: user2Phone,
                        dateDetails
                    }
                });

                // Send to User 2 (needs partner's phone i.e. user1Phone)
                allRecipients1h.push({
                    userId: date.user2_id,
                    customData: {
                        partnerName: date.user1.first_name,
                        partnerPhone: user1Phone,
                        dateDetails
                    }
                });

                datesToUpdate1h.push(date.id);
            }
        }

        // Process Planning 48h (Sent to users who haven't confirmed)
        if (datesPlanning48h && datesPlanning48h.length > 0) {
            console.log(`Found ${datesPlanning48h.length} dates for planning 48h check`);
            for (const date of datesPlanning48h) {
                if (!date.user1 || !date.user2) continue;

                const u1Avail = date.user1_availability && Object.keys(date.user1_availability).length > 0;
                const u2Avail = date.user2_availability && Object.keys(date.user2_availability).length > 0;

                // User 1 logic
                let sendToU1 = false;
                if (!u1Avail) {
                    // Hasn't entered availability -> Send
                    sendToU1 = true;
                } else if (u1Avail && u2Avail) {
                    // Both entered availability, but U1 hasn't confirmed -> Send
                    if (!date.user1_confirmed) {
                        sendToU1 = true;
                    }
                }

                if (sendToU1) {
                    allRecipientsPlan48h.push({
                        userId: date.user1_id,
                        customData: { partnerName: date.user2.first_name }
                    });
                }

                // User 2 logic
                let sendToU2 = false;
                if (!u2Avail) {
                    // Hasn't entered availability -> Send
                    sendToU2 = true;
                } else if (u1Avail && u2Avail) {
                    // Both entered availability, but U2 hasn't confirmed -> Send
                    if (!date.user2_confirmed) {
                        sendToU2 = true;
                    }
                }

                if (sendToU2) {
                    allRecipientsPlan48h.push({
                        userId: date.user2_id,
                        customData: { partnerName: date.user1.first_name }
                    });
                }

                datesToUpdatePlan48h.push(date.id);
            }
        }

        // Process Planning Soon
        // Already filtered in Query 4
        if (datesPlanningSoon && datesPlanningSoon.length > 0) {
            console.log(`Found ${datesPlanningSoon.length} dates for planning soon check`);

            for (const date of datesPlanningSoon) {
                if (!date.user1 || !date.user2) continue;

                const u1Avail = date.user1_availability && Object.keys(date.user1_availability).length > 0;
                const u2Avail = date.user2_availability && Object.keys(date.user2_availability).length > 0;

                // User 1 logic
                let sendToU1 = false;
                if (!u1Avail) {
                    sendToU1 = true;
                } else if (u1Avail && u2Avail) {
                    if (!date.user1_confirmed) {
                        sendToU1 = true;
                    }
                }

                if (sendToU1) {
                    allRecipientsPlanSoon.push({
                        userId: date.user1_id,
                        customData: {
                            partnerName: date.user2.first_name,
                            firstPossibleDay: date.first_possible_day
                        }
                    });
                }

                // User 2 logic
                let sendToU2 = false;
                if (!u2Avail) {
                    sendToU2 = true;
                } else if (u1Avail && u2Avail) {
                    if (!date.user2_confirmed) {
                        sendToU2 = true;
                    }
                }

                if (sendToU2) {
                    allRecipientsPlanSoon.push({
                        userId: date.user2_id,
                        customData: {
                            partnerName: date.user1.first_name,
                            firstPossibleDay: date.first_possible_day
                        }
                    });
                }
                datesToUpdatePlanSoon.push(date.id);
            }
        }

        // Send Emails
        const results = {
            dryRun,
            sent24h: 0,
            sent1h: 0,
            sentPlan48h: 0,
            sentPlanSoon: 0,
            recipients24h: allRecipients24h,
            recipients1h: allRecipients1h,
            recipientsPlan48h: allRecipientsPlan48h,
            recipientsPlanSoon: allRecipientsPlanSoon,
            errors: [] as any[]
        };

        if (!dryRun) {
            if (allRecipients24h.length > 0) {
                const { error } = await supabase.functions.invoke('send-user-emails', {
                    headers: internalHeaders,
                    body: {
                        emailType: 'date_reminder_1d',
                        recipients: allRecipients24h
                    }
                });
                if (error) {
                    console.error("Error sending 24h reminders:", error);
                    results.errors.push(error);
                } else {
                    results.sent24h = allRecipients24h.length;
                    // Update DB checks
                    if (datesToUpdate24h.length > 0) {
                        await supabase.from("dates").update({ reminder_24h_sent: true }).in("id", datesToUpdate24h);
                    }
                }
            }

            if (allRecipients1h.length > 0) {
                const { error } = await supabase.functions.invoke('send-user-emails', {
                    headers: internalHeaders,
                    body: {
                        emailType: 'date_reminder_1h',
                        recipients: allRecipients1h
                    }
                });
                if (error) {
                    console.error("Error sending 1h reminders:", error);
                    results.errors.push(error);
                } else {
                    results.sent1h = allRecipients1h.length;
                    // Update DB checks
                    if (datesToUpdate1h.length > 0) {
                        await supabase.from("dates").update({ reminder_1h_sent: true }).in("id", datesToUpdate1h);
                    }
                }
            }

            if (allRecipientsPlan48h.length > 0) {
                const { error } = await supabase.functions.invoke('send-user-emails', {
                    headers: internalHeaders,
                    body: {
                        emailType: 'date_planning_reminder_48h',
                        recipients: allRecipientsPlan48h
                    }
                });
                if (error) {
                    console.error("Error sending planning 48h reminders:", error);
                    results.errors.push(error);
                } else {
                    results.sentPlan48h = allRecipientsPlan48h.length;
                }
                if (datesToUpdatePlan48h.length > 0) {
                    await supabase.from("dates").update({ reminder_planning_48h_sent: true }).in("id", datesToUpdatePlan48h);
                }
            }

            if (allRecipientsPlanSoon.length > 0) {
                const { error } = await supabase.functions.invoke('send-user-emails', {
                    headers: internalHeaders,
                    body: {
                        emailType: 'date_planning_reminder_soon',
                        recipients: allRecipientsPlanSoon
                    }
                });
                if (error) {
                    console.error("Error sending planning soon reminders:", error);
                    results.errors.push(error);
                } else {
                    results.sentPlanSoon = allRecipientsPlanSoon.length;
                }
                if (datesToUpdatePlanSoon.length > 0) {
                    await supabase.from("dates").update({ reminder_planning_soon_sent: true }).in("id", datesToUpdatePlanSoon);
                }
            }
        } else {
            console.log("Dry run complete. No emails sent or DB updated.");
            // Populate counts for return
            results.sent24h = allRecipients24h.length;
            results.sent1h = allRecipients1h.length;
            results.sentPlan48h = allRecipientsPlan48h.length;
            results.sentPlanSoon = allRecipientsPlanSoon.length;
        }

        return new Response(JSON.stringify({
            message: "Reminders processed",
            results
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error("Error in date reminder function:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
