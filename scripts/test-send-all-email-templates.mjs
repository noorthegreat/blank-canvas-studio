#!/usr/bin/env node

/*
 * Sends one test email for each supported send-user-emails template
 * to a single existing profile email (default: contact@yourorbiit.com).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/test-send-all-email-templates.mjs [targetEmail]
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET || process.env.SUPABASE_CRON_SECRET;
const targetEmail = process.argv[2] || "contact@yourorbiit.com";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

function decodeJwtRole(jwt) {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload.role || null;
  } catch {
    return null;
  }
}

function classifyKey(key) {
  if (!key) return "missing";
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("eyJ")) return "jwt";
  return "unknown";
}

async function fetchTargetProfileByEmail(email) {
  const filter = encodeURIComponent(`eq.${email}`);
  const url = `${SUPABASE_URL}/rest/v1/profiles?select=id,first_name,email&email=${filter}&limit=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed fetching profile (${res.status}): ${await res.text()}`);
  }
  const rows = await res.json();
  if (!rows.length) {
    throw new Error(
      `No profile found for ${email}. Create this user first in auth/profiles and rerun.`
    );
  }
  return rows[0];
}

function buildTests(userId) {
  const dateDetails = {
    date: "March 3, 2026",
    weekday: "Tuesday",
    time: "19:00",
    locationName: "Bovelli, Zurich",
    locationAddress: "Niederdorfstrasse 7, 8001 Zurich",
  };

  return [
    { emailType: "new_match", recipients: [{ userId }] },
    {
      emailType: "new_date",
      recipients: [{ userId, customData: { partnerName: "Alex", firstDay: "Tuesday" } }],
    },
    { emailType: "match_cancelled", recipients: [{ userId }] },
    {
      emailType: "auto-cancelled-date",
      recipients: [{ userId, customData: { partnerName: "Alex" } }],
    },
    {
      emailType: "date_cancelled",
      recipients: [{ userId, customData: { partnerName: "Alex", cancellationReason: "Test cancellation reason." } }],
    },
    {
      emailType: "no_overlap",
      recipients: [{ userId, customData: { partnerName: "Alex" } }],
    },
    {
      emailType: "first_confirm",
      recipients: [{ userId, customData: { partnerName: "Alex" } }],
    },
    {
      emailType: "date_rescheduled",
      recipients: [{ userId, customData: { partnerName: "Alex", rescheduleReason: "Running a full flow test." } }],
    },
    {
      emailType: "date_confirmed_details",
      recipients: [{ userId, customData: { partnerName: "Alex", dateDetails } }],
    },
    {
      emailType: "date_update_reset",
      recipients: [{ userId, customData: { partnerName: "Alex" } }],
    },
    { emailType: "new_dates_launch", recipients: [{ userId }] },
    { emailType: "event_announcement", recipients: [{ userId }] },
    {
      emailType: "blank_announcement",
      emailSubject: "Orbiit Theme QA Test",
      recipients: [
        {
          userId,
          customData: {
            content:
              "<p>This is a QA blast to verify dark blue/purple email styling and token replacements.</p>",
          },
        },
      ],
    },
    {
      emailType: "date_reminder_1d",
      recipients: [{ userId, customData: { partnerName: "Alex", dateDetails } }],
    },
    {
      emailType: "date_reminder_1h",
      recipients: [
        { userId, customData: { partnerName: "Alex", partnerPhone: "+41 79 123 45 67", dateDetails } },
      ],
    },
    {
      emailType: "date_reminder_soon",
      recipients: [
        { userId, customData: { partnerName: "Alex", partnerPhone: "+41 79 123 45 67", dateDetails } },
      ],
    },
    {
      emailType: "date_planning_reminder_48h",
      recipients: [{ userId, customData: { partnerName: "Alex" } }],
    },
    {
      emailType: "date_planning_reminder_soon",
      recipients: [{ userId, customData: { partnerName: "Alex", firstPossibleDay: "Tuesday, March 3" } }],
    },
  ];
}

async function sendTest(payload) {
  const functionHeaders = { ...headers };
  if (CRON_SECRET) {
    functionHeaders["X-Cron-Secret"] = CRON_SECRET;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-user-emails`, {
    method: "POST",
    headers: functionHeaders,
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return {
    ok: res.ok,
    status: res.status,
    body: json,
  };
}

async function probeFunctionAuth() {
  const functionHeaders = { ...headers };
  if (CRON_SECRET) {
    functionHeaders["X-Cron-Secret"] = CRON_SECRET;
  }

  // Intentionally invalid payload so auth-passing requests return 400, not 401.
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-user-emails`, {
    method: "POST",
    headers: functionHeaders,
    body: JSON.stringify({ emailType: "new_match", recipients: [] }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  console.log(`Target email: ${targetEmail}`);
  const role = decodeJwtRole(SERVICE_KEY);
  const keyType = classifyKey(SERVICE_KEY);
  console.log(`Key type: ${keyType}${role ? ` (role=${role})` : ""}`);
  console.log(`CRON_SECRET provided: ${CRON_SECRET ? "yes" : "no"}`);

  if (role && role !== "service_role" && !CRON_SECRET) {
    console.error(
      `SUPABASE_SERVICE_ROLE_KEY appears to be role="${role}", not "service_role".`
    );
    console.error("Use the project's service_role key, or set CRON_SECRET to invoke this function.");
    process.exit(1);
  }

  const authProbe = await probeFunctionAuth();
  if (authProbe.status === 401) {
    console.error("Auth probe failed with 401 Unauthorized.");
    console.error("This means the function rejected your auth before processing payload.");
    console.error(
      "Use the exact project service_role key, or provide the exact CRON_SECRET set in Supabase secrets."
    );
    console.error(`Probe response: ${JSON.stringify(authProbe.body)}`);
    process.exit(1);
  }
  if (authProbe.status !== 400) {
    console.error(
      `Unexpected auth probe response: ${authProbe.status} ${JSON.stringify(authProbe.body)}`
    );
    console.error("Expected 400 (auth passed, payload invalid).");
    process.exit(1);
  }

  const profile = await fetchTargetProfileByEmail(targetEmail);
  console.log(`Using user_id: ${profile.id}`);

  const tests = buildTests(profile.id);
  const results = [];

  for (const test of tests) {
    process.stdout.write(`Sending ${test.emailType} ... `);
    const result = await sendTest(test);
    results.push({ emailType: test.emailType, ...result });
    if (result.ok) {
      console.log("ok");
    } else {
      console.log(`failed (${result.status})`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\nSummary");
  console.log(`Total: ${results.length}`);
  console.log(`Success: ${results.length - failed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length) {
    console.log("\nFailed items:");
    for (const item of failed) {
      console.log(`- ${item.emailType}: ${item.status} ${JSON.stringify(item.body)}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
