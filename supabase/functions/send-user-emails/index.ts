/*
Sends users emails based on the email type. 
Sends up to 100 emails at a time (limited by Resend's batch API).

Example request payload:
{
  "emailType": "new_match",
  "recipients": [
  {"userId": "b7fcb0f9-41c0-4c5d-87df-2fd08d539a91"},
  {"userId": "736c6724-717c-43e6-a99e-789a8c39a0dd"}
  ]
}
*/

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { authenticateEdgeRequest } from "../_shared/auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface EmailRecipient {
  userId: string;
  customData?: any;
}

interface EmailRequest {
  emailType: 'new_match' | 'new_date' | 'date_reminder' | 'date_update' | 'match_cancelled' | 'date_cancelled' | 'auto-cancelled-date' | 'no_overlap' | 'first_confirm' | 'date_rescheduled' | 'date_confirmed_details' | 'date_update_reset' | 'new_dates_launch' | 'date_reminder_1d' | 'date_reminder_1h' | 'date_reminder_soon' | 'date_planning_reminder_48h' | 'date_planning_reminder_soon' | 'event_announcement' | 'blank_announcement';
  emailSubject?: string;
  recipients: EmailRecipient[];
  dateId?: string;
}

// ... existing helpers

async function generateDateUpdateResetEmail(
  firstName: string,
  partnerName: string
): Promise<string> {
  const template = await loadTemplate('date-update-reset');
  return replaceVariables(template, {
    firstName,
    partnerName,
  });
}



// ... existing helpers

async function generateDateConfirmedDetailsEmail(
  firstName: string,
  partnerName: string,
  dateDetails: { date: string; weekday: string; time: string; locationName: string; locationAddress: string }
): Promise<string> {
  const template = await loadTemplate('date-confirmed-details');
  return replaceVariables(template, {
    firstName,
    partnerName,
    date: dateDetails.date,
    weekday: dateDetails.weekday,
    time: dateDetails.time,
    locationName: dateDetails.locationName,
    locationAddress: dateDetails.locationAddress,
  });
}


// ... inside handler


interface Profile {
  id: string;
  first_name: string;
  email: string;
}

type DateAccessRow = {
  id: string;
  user1_id: string;
  user2_id: string;
  status: string | null;
  date_time: string | null;
};

const USER_ALLOWED_DATE_EMAIL_TYPES = new Set<EmailRequest["emailType"]>([
  "date_cancelled",
  "no_overlap",
  "first_confirm",
  "date_rescheduled",
  "date_confirmed_details",
]);

async function loadTemplate(templateName: string): Promise<string> {
  // Don't forget to upload the config.toml for additional static files!
  const path = `./_templates/${templateName}.html`;
  return await Deno.readTextFile(path);
}

function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;

  // Always add copyright year
  const allVariables = {
    ...variables,
    year: new Date().getFullYear().toString()
  };

  for (const [key, value] of Object.entries(allVariables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

async function generateMatchEmail(template: string, firstName: string): Promise<string> {

  return replaceVariables(template, {
    firstName,
  });
}

async function generateDateReminderSoonEmail(
  firstName: string,
  partnerName: string,
  partnerPhone: string,
  dateDetails: { date: string; weekday: string; time: string; locationName: string; locationAddress: string }
): Promise<string> {
  const template = await loadTemplate('date-reminder-soon');
  return replaceVariables(template, {
    firstName,
    partnerName,
    partnerPhone,
    date: dateDetails.date,
    weekday: dateDetails.weekday,
    time: dateDetails.time,
    locationName: dateDetails.locationName,
    locationAddress: dateDetails.locationAddress,
  });
}

async function generateMatchCancelledEmail(firstName: string): Promise<string> {
  const template = await loadTemplate('match-cancelled');
  return replaceVariables(template, {
    firstName,
  });
}

async function generateDateCancelledEmail(
  firstName: string,
  partnerName: string,
  cancellationReason: string
): Promise<string> {
  const template = await loadTemplate('date-cancelled');
  let cancellationSection = "";
  if (cancellationReason == "No reason provided") {
    cancellationSection = "";
  } else {
    cancellationSection = `<p style="color: #ffffff; font-size: 16px; margin: 20px 0;">They provided the following reason:</p>

    <div
        style="background: rgba(129, 140, 248, 0.12); border-left: 4px solid #6f5bff; padding: 15px; margin: 20px 0; font-style: italic; color: #ffffff;">
        ${cancellationReason}
    </div>`;
  }
  return replaceVariables(template, {
    firstName,
    partnerName,
    cancellationSection,
  });
}

async function generateDateEmail(
  firstName: string,
  partnerName: string,
  firstDay: string
): Promise<string> {
  const template = await loadTemplate('new-date');

  return replaceVariables(template, {
    firstName,
    partnerName,
    firstDay,
  });
}

async function generateDateReminderEmail(
  firstName: string,
  partnerName: string,
  dateDetails: { location: string; date_time: string; activity?: string }
): Promise<string> {
  const template = await loadTemplate('date-reminder');

  const activitySection = dateDetails.activity
    ? `<p style="color: #ffffff; font-size: 16px; margin: 15px 0;"><strong>🎯 Activity:</strong> ${dateDetails.activity}</p>`
    : '';

  return replaceVariables(template, {
    firstName,
    partnerName,
    location: dateDetails.location,
    dateTime: new Date(dateDetails.date_time).toLocaleString(),
    activitySection,
  });
}

async function generateDateUpdateEmail(
  firstName: string,
  partnerName: string,
  changes: string[],
  dateDetails: { location?: string; date_time?: string; activity?: string }
): Promise<string> {
  const template = await loadTemplate('date-update');

  const changesList = changes.map(change => `<li style="margin: 8px 0;">${change}</li>`).join('');

  const locationSection = dateDetails.location
    ? `<p style="color: #ffffff; font-size: 16px; margin: 15px 0;"><strong>📍 Location:</strong> ${dateDetails.location}</p>`
    : '';

  const timeSection = dateDetails.date_time
    ? `<p style="color: #ffffff; font-size: 16px; margin: 15px 0;"><strong>🕐 Time:</strong> ${new Date(dateDetails.date_time).toLocaleString()}</p>`
    : '';

  const activitySection = dateDetails.activity
    ? `<p style="color: #ffffff; font-size: 16px; margin: 15px 0;"><strong>🎯 Activity:</strong> ${dateDetails.activity}</p>`
    : '';

  return replaceVariables(template, {
    firstName,
    partnerName,
    changesList,
    locationSection,
    timeSection,
    activitySection,
  });
}

async function generateNoOverlapEmail(
  firstName: string,
  partnerName: string
): Promise<string> {
  const template = await loadTemplate('no-overlap');
  return replaceVariables(template, {
    firstName,
    partnerName,
  });
}

async function generateFirstConfirmEmail(
  firstName: string,
  partnerName: string
): Promise<string> {
  const template = await loadTemplate('first-confirm');
  return replaceVariables(template, {
    firstName,
    partnerName,
  });
}

async function generateNewDatesLaunchEmail(
  template: string,
  firstName: string
): Promise<string> {
  return replaceVariables(template, {
    firstName
  });
}

async function generateEventAnnouncementEmail(
  template: string,
  firstName: string
): Promise<string> {
  return replaceVariables(template, {
    firstName
  });
}

async function generateBlankAnnouncementEmail(
  template: string,
  firstName: string,
  content: string,
  subjectHeader: string
): Promise<string> {
  return replaceVariables(template, {
    firstName,
    content,
    subjectHeader
  });
}

async function generateDateRescheduledEmail(
  firstName: string,
  partnerName: string,
  rescheduleReason?: string
): Promise<string> {
  const template = await loadTemplate('date-rescheduled');

  const reasonSection = rescheduleReason
    ? `<div style="background: rgba(129, 140, 248, 0.12); border-left: 4px solid #6f5bff; padding: 16px 18px; margin: 20px 0 24px; border-radius: 4px; color: #ffffff;"><p style="font-size: 16px; margin: 0; font-style: italic; color: #ffffff;">Reason: "${rescheduleReason}"</p></div>`
    : '';

  return replaceVariables(template, {
    firstName,
    partnerName,
    reasonSection
  });
}

async function generateDateReminder1dEmail(
  firstName: string,
  partnerName: string,
  dateDetails: { date: string; weekday: string; time: string; locationName: string; locationAddress: string }
): Promise<string> {
  const template = await loadTemplate('date-reminder-1d');
  return replaceVariables(template, {
    firstName,
    partnerName,
    date: dateDetails.date,
    weekday: dateDetails.weekday,
    time: dateDetails.time,
    locationName: dateDetails.locationName,
    locationAddress: dateDetails.locationAddress,
  });
}

async function generateDateReminder1hEmail(
  firstName: string,
  partnerName: string,
  partnerPhone: string,
  dateDetails: { date: string; weekday: string; time: string; locationName: string; locationAddress: string }
): Promise<string> {
  const template = await loadTemplate('date-reminder-1h');
  return replaceVariables(template, {
    firstName,
    partnerName,
    partnerPhone,
    date: dateDetails.date,
    weekday: dateDetails.weekday,
    time: dateDetails.time,
    locationName: dateDetails.locationName,
    locationAddress: dateDetails.locationAddress,
  });
}

async function generateDatePlanningReminder48hEmail(
  firstName: string,
  partnerName: string
): Promise<string> {
  const template = await loadTemplate('date-planning-reminder-48h');
  return replaceVariables(template, {
    firstName,
    partnerName,
  });
}

async function generateDatePlanningReminderSoonEmail(
  firstName: string,
  partnerName: string,
  firstPossibleDay: string
): Promise<string> {
  const template = await loadTemplate('date-planning-reminder-soon');
  return replaceVariables(template, {
    firstName,
    partnerName,
    firstPossibleDay
  });
}

async function generateAutoCancelledDateEmail(
  firstName: string,
  partnerName: string
): Promise<string> {
  const template = await loadTemplate('auto-cancelled-date');
  return replaceVariables(template, {
    firstName,
    partnerName,
  });
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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
    const requestUser = auth.context!.user;
    const isPrivilegedCaller = auth.context!.isInternal || auth.context!.isAdmin;

    // Check for required env vars
    if (!Deno.env.get("RESEND_API_KEY")) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Parse and validate request
    const payload = await req.json();
    const { emailType, emailSubject, recipients, dateId } = payload as EmailRequest;

    if (!emailType || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid request. emailType and recipients array required." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!isPrivilegedCaller) {
      if (!requestUser) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!USER_ALLOWED_DATE_EMAIL_TYPES.has(emailType)) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!dateId) {
        return new Response(
          JSON.stringify({ error: "dateId is required for user-triggered date emails." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (recipients.length > 2) {
        return new Response(
          JSON.stringify({ error: "Too many recipients for user-triggered emails." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: rawDateRow, error: dateError } = await supabase
        .from("dates")
        .select("id, user1_id, user2_id, status, date_time")
        .eq("id", dateId)
        .maybeSingle();

      if (dateError) {
        throw dateError;
      }

      const dateRow = rawDateRow as DateAccessRow | null;

      if (!dateRow) {
        return new Response(
          JSON.stringify({ error: "Date not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const participantIds = new Set([dateRow.user1_id, dateRow.user2_id]);
      if (!participantIds.has(requestUser.id)) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasInvalidRecipient = recipients.some((recipient) => !participantIds.has(recipient.userId));
      if (hasInvalidRecipient) {
        return new Response(
          JSON.stringify({ error: "Recipients must belong to the same date." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (emailType === "date_confirmed_details" && (dateRow.status !== "confirmed" || !dateRow.date_time)) {
        return new Response(
          JSON.stringify({ error: "date_confirmed_details can only be sent for confirmed dates." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }


    console.log(`Processing ${emailType} emails for ${recipients.length} recipients`);

    // Fetch user profiles
    const userIds = recipients.map(r => r.userId);
    const [{ data: profileRows, error: profileError }, { data: privateRows }] = await Promise.all([
      supabase.from('profiles').select('id, first_name').in('id', userIds),
      supabase.from('private_profile_data').select('user_id, email').in('user_id', userIds),
    ]);

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
      throw new Error("Failed to fetch user profiles");
    }

    const privateEmailMap = new Map((privateRows || []).map((r: any) => [r.user_id, r.email]));
    const profiles = (profileRows || []).map((p: any) => ({
      ...p,
      email: privateEmailMap.get(p.id) ?? null,
    }));

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid users found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const results = {
      success: [] as string[],
      failed: [] as { userId: string; error: string }[],
    };

    // Step 1: Prepare all emails first
    interface PreparedEmail {
      userId: string;
      email: string;
      subject: string;
      html: string;
    }

    const preparedEmails: PreparedEmail[] = [];

    let newmatchtemplate = "";
    if (emailType === "new_match") {
      try {
        newmatchtemplate = await loadTemplate('new-match');
      } catch (error) {
        console.error("Failed to load new-match template:", error);
        throw new Error("Failed to load email templates");
      }
    }
    let newdateslaunchtemplate = "";
    if (emailType === "new_dates_launch") {
      try {
        newdateslaunchtemplate = await loadTemplate('new-dates-launch');
      } catch (error) {
        console.error("Failed to load new-dates-launch template:", error);
        throw new Error("Failed to load email templates");
      }
    }
    let eventAnnouncementTemplate = "";
    if (emailType === "event_announcement") {
      try {
        eventAnnouncementTemplate = await loadTemplate('event-announcement');
      } catch (error) {
        console.error("Failed to load event-announcement template:", error);
        throw new Error("Failed to load email templates");
      }
    }
    let blankAnnouncementTemplate = "";
    if (emailType === "blank_announcement") {
      try {
        blankAnnouncementTemplate = await loadTemplate('blank-announcement');
      } catch (error) {
        console.error("Failed to load blank-announcement template:", error);
        throw new Error("Failed to load email templates");
      }
    }
    for (const recipient of recipients) {
      const profile = profiles.find(p => p.id === recipient.userId);

      if (!profile || !profile.email) {
        results.failed.push({
          userId: recipient.userId,
          error: "User profile or email not found"
        });
        continue;
      }

      try {
        let subject = "";
        let html = "";
        if (recipient.customData) {
          console.log("Recipient " + profile.email + " with custom data:", JSON.stringify(recipient.customData));
        }

        // Generate email based on type
        switch (emailType) {
          case 'new_match': {
            subject = `Orbiit - You've got a new match!`;
            html = await generateMatchEmail(newmatchtemplate, profile.first_name);
            break;
          }

          case 'new_date': {
            const { partnerName, firstDay } = recipient.customData;
            if (!partnerName) {
              throw new Error("Partner name required for new_date email");
            }
            subject = "You have a new date scheduled! ☕";
            html = await generateDateEmail(profile.first_name, partnerName, firstDay);
            break;
          }

          // case 'date_reminder': {
          //   const { partnerName, dateDetails } = recipient.customData || {};
          //   if (!partnerName || !dateDetails?.location || !dateDetails?.date_time) {
          //     throw new Error("Partner name, location, and date_time required for date_reminder email");
          //   }
          //   subject = "Your date is coming up! 📅";
          //   html = await generateDateReminderEmail(profile.first_name, partnerName, dateDetails);
          //   break;
          // }

          // case 'date_update': {
          //   const { partnerName, changes, dateDetails } = recipient.customData || {};
          //   if (!partnerName || !changes || !Array.isArray(changes)) {
          //     throw new Error("Partner name and changes array required for date_update email");
          //   }
          //   subject = "Your date has been updated 🔄";
          //   html = await generateDateUpdateEmail(profile.first_name, partnerName, changes, dateDetails || {});
          //   break;
          // }

          case 'match_cancelled': {
            subject = "Update regarding your match";
            html = await generateMatchCancelledEmail(profile.first_name);
            break;
          }

          case 'auto-cancelled-date': {
            const { partnerName } = recipient.customData || {};
            if (!partnerName) {
              throw new Error("Partner name required for auto-cancelled-date email");
            }
            subject = "Match Expired ⌛";
            html = await generateAutoCancelledDateEmail(profile.first_name, partnerName);
            break;
          }

          case 'date_cancelled': {
            const { partnerName, cancellationReason } = recipient.customData || {};
            if (!partnerName) {
              throw new Error("Partner name required for date_cancelled email");
            }
            subject = "Update regarding your date";
            html = await generateDateCancelledEmail(
              profile.first_name,
              partnerName,
              cancellationReason || "No reason provided"
            );
            break;
          }

          case 'no_overlap': {
            const { partnerName } = recipient.customData || {};
            if (!partnerName) {
              throw new Error("Partner name required for no_overlap email");
            }
            subject = "Update regarding your date availability";
            html = await generateNoOverlapEmail(profile.first_name, partnerName);
            break;
          }

          case 'first_confirm': {
            const { partnerName } = recipient.customData || {};
            if (!partnerName) {
              throw new Error("Partner name required for first_confirm email");
            }
            subject = "Date confirmation update";
            html = await generateFirstConfirmEmail(profile.first_name, partnerName);
            break;
          }

          case 'date_rescheduled': {
            const { partnerName, rescheduleReason } = recipient.customData || {};
            if (!partnerName) {
              throw new Error("Partner name required for date_rescheduled email");
            }
            subject = "Date Rescheduled 🗓️";
            html = await generateDateRescheduledEmail(profile.first_name, partnerName, rescheduleReason);
            break;
          }

          case 'date_confirmed_details': {
            const { partnerName, dateDetails } = recipient.customData || {};
            if (!partnerName || !dateDetails) {
              throw new Error("Partner name and dateDetails required for date_confirmed_details email");
            }
            subject = "It's a Date! 🎉";
            html = await generateDateConfirmedDetailsEmail(profile.first_name, partnerName, dateDetails);
            break;
          }

          case 'date_update_reset': {
            const { partnerName } = recipient.customData || {};
            if (!partnerName) {
              throw new Error("Partner name required for date_update_reset email");
            }
            subject = "Date Updated 🔄";
            html = await generateDateUpdateResetEmail(profile.first_name, partnerName);
            break;
          }

          case 'new_dates_launch': {
            subject = "Orbiit - New Dates Feature! 🚀";
            html = await generateNewDatesLaunchEmail(newdateslaunchtemplate, profile.first_name);
            break;
          }

          case 'event_announcement': {
            subject = "Updates on Orbiit + Meet Us IRL at Nachtseminar";
            html = await generateEventAnnouncementEmail(eventAnnouncementTemplate, profile.first_name);
            break;
          }

          case 'blank_announcement': {
            const { content } = recipient.customData || {};
            if (!content) throw new Error("Content required for blank_announcement email");

            subject = emailSubject || "Update from Orbiit ⭐";
            html = await generateBlankAnnouncementEmail(blankAnnouncementTemplate, profile.first_name, content, subject);
            break;
          }

          case 'date_reminder_1d': {
            const { partnerName, dateDetails } = recipient.customData || {};
            if (!partnerName || !dateDetails) {
              throw new Error("Partner name and dateDetails required for date_reminder_1d email");
            }
            subject = "Your date is tomorrow! ⏰";
            html = await generateDateReminder1dEmail(profile.first_name, partnerName, dateDetails);
            break;
          }

          case 'date_reminder_1h': {
            const { partnerName, partnerPhone, dateDetails } = recipient.customData || {};
            if (!partnerName || !dateDetails) {
              throw new Error("Partner name and dateDetails required for date_reminder_1h email");
            }
            subject = "Your date is in 1 hour! ⏳";
            html = await generateDateReminder1hEmail(profile.first_name, partnerName, partnerPhone || "Not available", dateDetails);
            break;
          }

          case 'date_reminder_soon': {
            const { partnerName, partnerPhone, dateDetails } = recipient.customData || {};
            if (!partnerName || !dateDetails) {
              throw new Error("Partner name and dateDetails required for date_reminder_soon email");
            }
            subject = "Your date is coming up soon! ⏳";
            html = await generateDateReminderSoonEmail(profile.first_name, partnerName, partnerPhone || "Not available", dateDetails);
            break;
          }

          case 'date_planning_reminder_48h': {
            const { partnerName } = recipient.customData || {};
            if (!partnerName) {
              throw new Error("Partner name required for date_planning_reminder_48h email");
            }
            subject = "Don't forget to plan your date! 📅";
            html = await generateDatePlanningReminder48hEmail(profile.first_name, partnerName);
            break;
          }

          case 'date_planning_reminder_soon': {
            const { partnerName, firstPossibleDay } = recipient.customData || {};
            if (!partnerName || !firstPossibleDay) {
              throw new Error("Partner name and firstPossibleDay required for date_planning_reminder_soon email");
            }
            subject = "Action needed for your date! ⏳";
            html = await generateDatePlanningReminderSoonEmail(profile.first_name, partnerName, firstPossibleDay);
            break;
          }

          default:
            throw new Error(`Unknown email type: ${emailType}`);
        }

        preparedEmails.push({
          userId: recipient.userId,
          email: profile.email,
          subject,
          html,
        });

      } catch (error: any) {
        console.error(`Failed to prepare email for ${profile.email}:`, error);
        results.failed.push({
          userId: recipient.userId,
          error: error.message || "Unknown error"
        });
      }
    }

    console.log(`Prepared ${preparedEmails.length} emails`);

    // Step 2: Send emails in batches of 100 using batch API
    const BATCH_SIZE = 100;
    const RATE_LIMIT_DELAY_MS = 4000; // 4 seconds between batch API calls

    for (let i = 0; i < preparedEmails.length; i += BATCH_SIZE) {
      const batch = preparedEmails.slice(i, i + BATCH_SIZE);

      try {
        // Prepare batch payload for Resend batch API
        const batchPayload = batch.map(email => ({
          from: "Orbiit Team <orbiit@nice-letters.com>",
          to: [email.email],
          subject: email.subject,
          html: email.html,
        }));

        console.log(`Sending batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} emails`);

        // Send batch via Resend batch API
        const batchResponse = await resend.batch.send(batchPayload);

        console.log(`Batch sent:`, batchResponse);

        // Mark all emails in this batch as successful
        // Note: If batch.send returns individual statuses, we should check them
        // For now, assuming all succeed if the batch call succeeds
        for (const email of batch) {
          results.success.push(email.userId);
        }

      } catch (error: any) {
        console.error(`Failed to send batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);

        // Mark all emails in this batch as failed
        for (const email of batch) {
          results.failed.push({
            userId: email.userId,
            error: error.message || "Batch send failed"
          });
        }
      }

      // Add delay between batches to respect rate limits (except for the last batch)
      if (i + BATCH_SIZE < preparedEmails.length) {
        console.log(`Waiting ${RATE_LIMIT_DELAY_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
    }

    console.log(`Email sending complete. Success: ${results.success.length}, Failed: ${results.failed.length}`);

    return new Response(
      JSON.stringify({
        message: "Email processing complete",
        results,
        summary: {
          total: recipients.length,
          sent: results.success.length,
          failed: results.failed.length
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-user-emails function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
