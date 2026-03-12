/*
This is the function that calculates new matches for every user.
It's run as a cron job by Supabase, with the pg_cron extension.

It does the following:
1. Gets all users who have completed the questionnaire
2. For each user, it finds potential matches based on personality compatibility
3. Sends match notification emails to users who have at least one match they haven't already liked
*/
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Set to true to only match test users (users with 'admin' or 'test' roles)
// Profiles 1 outer loop: 339 Profiles 1 skipped: 0 Profiles 2 loop: 57291 age errors: 7430
// Profiles 1 outer loop: 339 Profiles 1 skipped: 0 Profiles 2 loop: 57291 age errors: 0
const TEST_MODE = false;
const WEEKLY_DROP_UTC_DAY = 1; // Monday
const WEEKLY_DROP_UTC_HOUR = 8; // 08:00 UTC
// Allow execution any time on Monday after the weekly drop hour.
// Duplicate runs are prevented by the "already generated this week" check below.
const WEEKLY_DROP_WINDOW_HOURS = 24;
const MAX_WEEKLY_MATCHES_PER_USER = 5;
const FRIENDSHIP_MAX_WEEKLY_MATCHES_PER_USER = 5;
const MAX_UNANSWERED_LIKE_REMATCHES = 2;
let ageerrors = 0;
let outstring = "";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PersonalityAnswer {
  user_id: string;
  question_number: number;
  answer: string;
}

interface Profile {
  id: string;
  age: number;
  first_name: string;
  last_name: string | null;
  email: string;
  latitude: number | null;
  longitude: number | null;
}

type ChartDatum = {
  label: string;
  count: number;
};

type CurrentRelationshipMatchRow = {
  user_id: string;
  matched_user_id: string;
  from_algorithm: string | null;
  match_type: string | null;
  created_at: string | null;
};

type HistoricalRelationshipMatchRow = {
  user_id: string;
  matched_user_id: string;
  from_algorithm: string | null;
  match_type: string | null;
};

type UnansweredLikeRematchState = {
  unansweredLikeCount: number;
  lastPairingCreatedAt: string | null;
};

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function getCurrentWeeklyDropStartUTC(now: Date): Date {
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const thisMondayAtDrop = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday,
    WEEKLY_DROP_UTC_HOUR,
    0,
    0,
    0
  );
  const startMs = now.getTime() >= thisMondayAtDrop
    ? thisMondayAtDrop
    : thisMondayAtDrop - (7 * 24 * 60 * 60 * 1000);
  return new Date(startMs);
}

function isStudentEmail(email?: string | null): boolean {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return false;
  const domain = normalized.split("@")[1];
  return domain === "uzh.ch" || domain.endsWith(".uzh.ch") || domain === "ethz.ch" || domain.endsWith(".ethz.ch");
}

function normalizeName(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName || "").trim().toLowerCase();
  const last = (lastName || "").trim().toLowerCase();
  return `${first}|${last}`;
}

function getDirectionalRematchState(
  rematchMap: Record<string, Record<string, UnansweredLikeRematchState>>,
  userId: string,
  matchedUserId: string
): UnansweredLikeRematchState {
  return rematchMap[userId]?.[matchedUserId] || {
    unansweredLikeCount: 0,
    lastPairingCreatedAt: null,
  };
}

function setDirectionalRematchState(
  rematchMap: Record<string, Record<string, UnansweredLikeRematchState>>,
  userId: string,
  matchedUserId: string,
  state: UnansweredLikeRematchState
) {
  if (!rematchMap[userId]) rematchMap[userId] = {};
  rematchMap[userId][matchedUserId] = state;
}

function getPairUnansweredLikeRematchCount(
  rematchMap: Record<string, Record<string, UnansweredLikeRematchState>>,
  user1Id: string,
  user2Id: string
): number {
  const oneWay = getDirectionalRematchState(rematchMap, user1Id, user2Id).unansweredLikeCount;
  const reverse = getDirectionalRematchState(rematchMap, user2Id, user1Id).unansweredLikeCount;
  return Math.max(oneWay, reverse);
}

function shouldApplyPairingUpdate(lastPairingCreatedAt: string | null, pairingCreatedAt: string | null): boolean {
  if (!pairingCreatedAt) return false;
  if (!lastPairingCreatedAt) return true;
  return new Date(lastPairingCreatedAt).getTime() < new Date(pairingCreatedAt).getTime();
}

function getUniqueRelationshipPairs(rows: CurrentRelationshipMatchRow[]): Array<{ user1Id: string; user2Id: string; created_at: string | null }> {
  const pairMap = new Map<string, { user1Id: string; user2Id: string; created_at: string | null }>();

  for (const row of rows) {
    const [user1Id, user2Id] = [row.user_id, row.matched_user_id].sort();
    const key = `${user1Id}|${user2Id}`;
    const existing = pairMap.get(key);

    if (!existing) {
      pairMap.set(key, { user1Id, user2Id, created_at: row.created_at ?? null });
      continue;
    }

    if (row.created_at && (!existing.created_at || new Date(row.created_at).getTime() > new Date(existing.created_at).getTime())) {
      pairMap.set(key, { user1Id, user2Id, created_at: row.created_at });
    }
  }

  return Array.from(pairMap.values());
}

async function prepareRelationshipUnansweredLikeRematchMap(
  supabase: any,
  dryRun: boolean,
  currentMatches: CurrentRelationshipMatchRow[],
  likeMap: Record<string, Set<string>>,
  dislikeMap: Record<string, Set<string>>
): Promise<Record<string, Record<string, UnansweredLikeRematchState>>> {
  const rematchMap: Record<string, Record<string, UnansweredLikeRematchState>> = {};
  const { data: counterRows, error: counterRowsError } = await supabase
    .from("unanswered_like_rematch_counts")
    .select("user_id, matched_user_id, unanswered_like_count, last_pairing_created_at")
    .eq("match_type", "relationship");

  if (counterRowsError) {
    console.warn("unanswered_like_rematch_counts query failed; continuing with empty counters", counterRowsError.message);
  }

  (counterRows || []).forEach((row: any) => {
    setDirectionalRematchState(rematchMap, row.user_id, row.matched_user_id, {
      unansweredLikeCount: row.unanswered_like_count || 0,
      lastPairingCreatedAt: row.last_pairing_created_at || null,
    });
  });

  const upserts = new Map<string, any>();
  const queuePersist = (userId: string, matchedUserId: string, state: UnansweredLikeRematchState) => {
    upserts.set(`${userId}:${matchedUserId}`, {
      user_id: userId,
      matched_user_id: matchedUserId,
      match_type: "relationship",
      unanswered_like_count: state.unansweredLikeCount,
      last_pairing_created_at: state.lastPairingCreatedAt,
      updated_at: new Date().toISOString(),
    });
  };

  const relationshipRows = currentMatches.filter(
    (row) => row.from_algorithm === "relationship" && row.match_type === "relationship"
  );

  for (const pair of getUniqueRelationshipPairs(relationshipRows)) {
    const user1Liked = likeMap[pair.user1Id]?.has(pair.user2Id) || false;
    const user2Liked = likeMap[pair.user2Id]?.has(pair.user1Id) || false;
    const user1Disliked = dislikeMap[pair.user1Id]?.has(pair.user2Id) || false;
    const user2Disliked = dislikeMap[pair.user2Id]?.has(pair.user1Id) || false;

    if (user1Liked && user2Liked) {
      const resetState = {
        unansweredLikeCount: 0,
        lastPairingCreatedAt: pair.created_at,
      };
      setDirectionalRematchState(rematchMap, pair.user1Id, pair.user2Id, resetState);
      setDirectionalRematchState(rematchMap, pair.user2Id, pair.user1Id, resetState);
      queuePersist(pair.user1Id, pair.user2Id, resetState);
      queuePersist(pair.user2Id, pair.user1Id, resetState);
      continue;
    }

    if (user1Liked && !user2Liked && !user2Disliked) {
      const existingState = getDirectionalRematchState(rematchMap, pair.user1Id, pair.user2Id);
      if (shouldApplyPairingUpdate(existingState.lastPairingCreatedAt, pair.created_at)) {
        const nextState = {
          unansweredLikeCount: existingState.unansweredLikeCount + 1,
          lastPairingCreatedAt: pair.created_at,
        };
        setDirectionalRematchState(rematchMap, pair.user1Id, pair.user2Id, nextState);
        queuePersist(pair.user1Id, pair.user2Id, nextState);
      }
    }

    if (user2Liked && !user1Liked && !user1Disliked) {
      const existingState = getDirectionalRematchState(rematchMap, pair.user2Id, pair.user1Id);
      if (shouldApplyPairingUpdate(existingState.lastPairingCreatedAt, pair.created_at)) {
        const nextState = {
          unansweredLikeCount: existingState.unansweredLikeCount + 1,
          lastPairingCreatedAt: pair.created_at,
        };
        setDirectionalRematchState(rematchMap, pair.user2Id, pair.user1Id, nextState);
        queuePersist(pair.user2Id, pair.user1Id, nextState);
      }
    }
  }

  if (!dryRun && upserts.size > 0) {
    const { error: persistError } = await supabase
      .from("unanswered_like_rematch_counts")
      .upsert(Array.from(upserts.values()), { onConflict: "user_id,matched_user_id,match_type" });

    if (persistError) {
      console.error("Failed to persist unanswered like rematch counters", persistError);
    }
  }

  return rematchMap;
}

/**
 * Send match notification emails by invoking the send-user-emails edge function asynchronously
 * This function fires off the email sending process without waiting for it to complete
 * Only sends emails to users who have at least one match they haven't already liked
 */
function sendMatchNotificationEmails(
  supabase: any,
  runResults: Array<{
    user1_id: string;
    user2_id: string;
    user1_liked_user2: boolean;
    user2_liked_user1: boolean;
    [key: string]: any;
  }>,
  cronSecret: string
): void {
  // Build a set of users who should receive emails
  // A user should receive an email if they have at least one match they haven't already liked
  const usersToEmail = new Set<string>();

  for (const result of runResults) {
    // If user1 hasn't liked user2, they should get an email about this match
    if (!result.user1_liked_user2) {
      usersToEmail.add(result.user1_id);
    }
    // If user2 hasn't liked user1, they should get an email about this match
    if (!result.user2_liked_user1) {
      usersToEmail.add(result.user2_id);
    }
  }

  console.log(`Triggering match notification emails for ${usersToEmail.size} users (async)`);

  if (usersToEmail.size === 0) {
    console.log('No users need email notifications - all users have already liked their matches');
    return;
  }

  // Prepare recipients array for send-user-emails edge function
  const recipients = Array.from(usersToEmail).map(userId => ({
    userId
  }));

  // Invoke send-user-emails edge function asynchronously (fire and forget)
  supabase.functions.invoke('send-user-emails', {
    body: {
      emailType: 'new_match',
      recipients
    },
    headers: {
      'X-Cron-Secret': cronSecret
    }
  }).catch((error: any) => {
    console.error('Failed to invoke send-user-emails function:', error);
  });

  console.log('Email sending process initiated asynchronously');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  // Default to real execution. Dry-run must be explicitly requested.
  let dryRun = false;
  const dryRunHeader = req.headers.get("dry-run");
  if (dryRunHeader === "true") {
    dryRun = true;
  }

  // Parse body for debug_user_id / overrides
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body might be empty
  }
  const debugUserId = body?.debug_user_id;
  const forceWeeklyDrop = body?.force_weekly_drop === true;
  const debugAll = body?.debug_all === true;
  const compact = body?.compact === true;
  const previewLimitRaw = Number(body?.preview_limit);
  const previewLimit = Number.isFinite(previewLimitRaw) && previewLimitRaw > 0
    ? Math.min(Math.floor(previewLimitRaw), 5000)
    : 5000;
  if (body?.dry_run === true) {
    dryRun = true;
  }

  // Validate CRON_SECRET or admin auth to prevent unauthorized access
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("X-Cron-Secret");
  let isAdmin = false;
  if (providedSecret !== cronSecret) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: hasAdminRole } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        if (hasAdminRole) isAdmin = true;
      }
    }
  }

  if (providedSecret !== cronSecret && !isAdmin) {
    console.error("Unauthorized cron attempt - invalid secret");
    return new Response(JSON.stringify({
      error: "Unauthorized"
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  try {
    console.log(`Daily cron job started at: ${new Date().toISOString()} (dry-run: ${dryRun}, debug_user: ${debugUserId}, force_weekly_drop: ${forceWeeklyDrop})`);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Weekly drop policy:
    // - Only generate relationship matches on Monday at 08:00 UTC (within 1-hour window).
    // - If already generated this week, skip.
    if (!dryRun && !forceWeeklyDrop) {
      const now = new Date();
      const isMonday = now.getUTCDay() === WEEKLY_DROP_UTC_DAY;
      const hour = now.getUTCHours();
      const inDropWindow = isMonday && hour >= WEEKLY_DROP_UTC_HOUR && hour < Math.min(24, WEEKLY_DROP_UTC_HOUR + WEEKLY_DROP_WINDOW_HOURS);

      if (!inDropWindow) {
        return new Response(JSON.stringify({
          success: true,
          skipped: true,
          message: "Outside weekly drop window. Matches generate on Mondays after 08:00 UTC.",
          timestamp: now.toISOString()
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          },
          status: 200
        });
      }

      const weekStart = getCurrentWeeklyDropStartUTC(now);
      const { count: alreadyGeneratedCount, error: weeklyCheckError } = await supabase
        .from("matches")
        .select("id", { head: true, count: "exact" })
        .eq("from_algorithm", "relationship")
        .gte("created_at", weekStart.toISOString());

      if (weeklyCheckError) {
        throw weeklyCheckError;
      }

      if ((alreadyGeneratedCount || 0) > 0) {
        return new Response(JSON.stringify({
          success: true,
          skipped: true,
          message: "Weekly relationship match drop already generated for this week.",
          timestamp: now.toISOString()
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          },
          status: 200
        });
      }
    }

    if (!dryRun && forceWeeklyDrop) {
      console.log("Force weekly drop override enabled by authorized caller.");
    }

    // Get all users who have completed the questionnaire and are not paused
    let profilesQuery = supabase.from("profiles")
      .select("id, age, first_name")
      .eq("completed_questionnaire", true)
      .neq("is_paused", true);
    // If in test mode, only get users with admin or test roles
    if (TEST_MODE) {
      const { data: testUserIds } = await supabase.from("user_roles").select("user_id").in("role", [
        "admin",
        "test"
      ]);
      const testIds = testUserIds?.map((r) => r.user_id) || [];
      if (testIds.length === 0) {
        console.log("TEST_MODE enabled but no test users found");
        return new Response(JSON.stringify({
          success: true,
          message: "No test users to process",
          timestamp: new Date().toISOString()
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          },
          status: 200
        });
      }
      profilesQuery = profilesQuery.in("id", testIds);
      console.log(`TEST_MODE enabled: Processing ${testIds.length} test users only`);
    }
    const { data: profilesData, error: profilesError } = await profilesQuery;
    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }
    const baseProfiles = profilesData || [];
    if (TEST_MODE) console.log(`Found ${baseProfiles?.length || 0} users with completed questionnaires`);
    if (!baseProfiles || baseProfiles.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No users to process",
        timestamp: new Date().toISOString()
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    }

    const profileIds = baseProfiles.map((p: { id: string }) => p.id);

    // Fetch private data in chunks to avoid oversized query strings.
    const privateDataRows: any[] = [];
    for (const ids of chunkArray(profileIds, 100)) {
      const { data: chunkRows, error: privateDataError } = await supabase
        .from("private_profile_data")
        .select("user_id, email, last_name, latitude, longitude")
        .in("user_id", ids);
      if (privateDataError) {
        console.error("Error fetching private profile data:", privateDataError);
        throw privateDataError;
      }
      privateDataRows.push(...(chunkRows || []));
    }
    const privateByUser = new Map((privateDataRows || []).map((r: any) => [r.user_id, r]));
    let profiles = baseProfiles.map((p: any) => {
      const priv = privateByUser.get(p.id) || {};
      return { ...p, email: priv.email ?? null, last_name: priv.last_name ?? null, latitude: priv.latitude ?? null, longitude: priv.longitude ?? null };
    });

    const usersBeforeFeedbackGate = profiles.length;
    let feedbackGateBlockedCount = 0;
    let debugUserBlockedByFeedbackGate = false;

    // Feedback gate: users with completed dates must submit date feedback
    // (follow-up preference + at least one answer) before receiving new weekly matches.
    const idChunks = chunkArray(profileIds, 100);
    const completedAsUser1Rows: any[] = [];
    const completedAsUser2Rows: any[] = [];

    for (const ids of idChunks) {
      const [completedAsUser1Res, completedAsUser2Res] = await Promise.all([
        supabase
          .from("dates")
          .select("id, user1_id, user2_id, user1_followup_preference, user2_followup_preference")
          .eq("status", "completed")
          .in("user1_id", ids),
        supabase
          .from("dates")
          .select("id, user1_id, user2_id, user1_followup_preference, user2_followup_preference")
          .eq("status", "completed")
          .in("user2_id", ids),
      ]);

      if (completedAsUser1Res.error) throw completedAsUser1Res.error;
      if (completedAsUser2Res.error) throw completedAsUser2Res.error;

      completedAsUser1Rows.push(...(completedAsUser1Res.data || []));
      completedAsUser2Rows.push(...(completedAsUser2Res.data || []));
    }

    const completedDatesById = new Map<string, any>();
    for (const d of completedAsUser1Rows) completedDatesById.set(d.id, d);
    for (const d of completedAsUser2Rows) completedDatesById.set(d.id, d);
    const completedDates = Array.from(completedDatesById.values());

    if (completedDates.length > 0) {
      const completedDateIds = completedDates.map((d: { id: string }) => d.id);
      const feedbackAnswersRows: any[] = [];
      const profileIdSet = new Set(profileIds);
      const dateIdChunks = chunkArray(completedDateIds, 50);
      for (const dateIds of dateIdChunks) {
        const { data: feedbackAnswers, error: feedbackAnswersError } = await supabase
          .from("date_feedback_answers")
          .select("date_id, user_id")
          .in("date_id", dateIds);
        if (feedbackAnswersError) throw feedbackAnswersError;
        feedbackAnswersRows.push(
          ...(feedbackAnswers || []).filter((a: { user_id: string }) => profileIdSet.has(a.user_id))
        );
      }

      const answeredUserDate = new Set<string>(
        feedbackAnswersRows.map((a: { user_id: string; date_id: string }) => `${a.user_id}:${a.date_id}`)
      );
      const blockedForMissingFeedback = new Set<string>();

      for (const date of completedDates) {
        if (profileIds.includes(date.user1_id)) {
          const hasPref = !!date.user1_followup_preference;
          const hasAnswers = answeredUserDate.has(`${date.user1_id}:${date.id}`);
          if (!hasPref || !hasAnswers) blockedForMissingFeedback.add(date.user1_id);
        }

        if (profileIds.includes(date.user2_id)) {
          const hasPref = !!date.user2_followup_preference;
          const hasAnswers = answeredUserDate.has(`${date.user2_id}:${date.id}`);
          if (!hasPref || !hasAnswers) blockedForMissingFeedback.add(date.user2_id);
        }
      }

      if (blockedForMissingFeedback.size > 0) {
        feedbackGateBlockedCount = blockedForMissingFeedback.size;
        if (debugUserId && blockedForMissingFeedback.has(debugUserId)) {
          debugUserBlockedByFeedbackGate = true;
        }
        profiles = profiles.filter((p: { id: string }) => !blockedForMissingFeedback.has(p.id));
        console.log(`Feedback gate excluded ${blockedForMissingFeedback.size} users from this weekly drop.`);
      }
    }

    if (profiles.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No users eligible after feedback gate filtering",
        timestamp: new Date().toISOString()
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    }

    // Keep test/admin users isolated from regular users in automatic matching.
    const { data: roleRows, error: roleRowsError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "test"]);
    if (roleRowsError) {
      console.error("Error fetching user roles:", roleRowsError);
      throw roleRowsError;
    }
    const privilegedUserIds = new Set<string>((roleRows || []).map((r: { user_id: string }) => r.user_id));
    // Get personality answers only for users with completed questionnaires
    const { data: allAnswers, error: answersError } = await supabase.from("personality_answers").select("*");
    if (answersError) {
      console.error("Error fetching answers:", answersError);
      throw answersError;
    }
    // Get all dislikes to exclude them from matches
    const { data: allDislikes, error: dislikesError } = await supabase.from("dislikes").select("user_id, disliked_user_id");
    if (dislikesError) {
      console.error("Error fetching dislikes:", dislikesError);
      throw dislikesError;
    }

    // Get all likes to include in results
    const { data: allLikes, error: likesError } = await supabase.from("likes").select("user_id, liked_user_id");
    if (likesError) {
      console.error("Error fetching likes:", likesError);
      throw likesError;
    }

    // Get match history to count previous matches per user
    let { data: matchHistory, error: matchHistoryError } = await supabase
      .from("match_history")
      .select("user_id, matched_user_id, match_type, from_algorithm");
    if (matchHistoryError) {
      console.error("Error fetching match history:", matchHistoryError);
      throw matchHistoryError;
    }

    const { data: currentMatches, error: currentMatchesError } = await supabase
      .from("matches")
      .select("user_id, matched_user_id, from_algorithm, match_type, created_at");
    if (currentMatchesError) {
      console.error("Error fetching current matches:", currentMatchesError);
      throw currentMatchesError;
    }
    matchHistory = [...(matchHistory || []), ...(currentMatches || [])];
    // Count total times userA has matched with userB, for each user pair
    const userMatchCounts: Record<string, Record<string, number>> = {};
    (matchHistory as HistoricalRelationshipMatchRow[] | null)?.forEach((match) => {
      const isFriendshipMatch = match.match_type === "friendship" || match.from_algorithm === "friendship";
      if (isFriendshipMatch) return;
      if (!userMatchCounts[match.user_id]) userMatchCounts[match.user_id] = {}
      userMatchCounts[match.user_id][match.matched_user_id] = (userMatchCounts[match.user_id]?.[match.matched_user_id] || 0) + 1;
    });

    // Get user activity data (last sign in) from auth.users
    const allAuthUsers: any[] = [];
    const perPage = 1000;
    let page = 1;
    while (true) {
      const { data: authPage, error: authUsersError } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });
      if (authUsersError) {
        console.error("Error fetching auth users:", authUsersError);
        throw authUsersError;
      }
      const batch = authPage?.users || [];
      allAuthUsers.push(...batch);
      if (batch.length < perPage) break;
      page += 1;
    }

    const authUsersById = new Map(allAuthUsers.map((user) => [user.id, user]));
    profiles = profiles.filter((profile: { id: string }) => {
      const authUser = authUsersById.get(profile.id);
      const hasVerifiedEmail = Boolean(authUser?.email_confirmed_at);
      return hasVerifiedEmail && isStudentEmail(authUser?.email || null);
    });

    if (profiles.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No users eligible after student/verified email gate",
        timestamp: new Date().toISOString()
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    }

    // Create map of user activity (days since last sign in)
    const userActivityMap: Record<string, number> = {};
    const now = new Date();
    allAuthUsers.forEach((user) => {
      if (user.last_sign_in_at) {
        const lastSignIn = new Date(user.last_sign_in_at);
        const daysSinceSignIn = (now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24);
        userActivityMap[user.id] = daysSinceSignIn;
      }
    });
    // Group answers by user
    const answersByUser: Record<string, Record<number, string>> = {};
    allAnswers?.forEach((answer: PersonalityAnswer) => {
      if (!answersByUser[answer.user_id]) answersByUser[answer.user_id] = {};
      answersByUser[answer.user_id][answer.question_number] = answer.answer;
    });

    const genderLabels: Record<string, string> = {
      A: "Woman",
      B: "Man",
      C: "Non-binary",
      D: "Prefer not to say",
    };
    const relationshipLabels: Record<string, string> = {
      A: "Long-term relationship",
      B: "Short-term dating",
      C: "Still figuring it out",
    };
    const openToLabels: Record<string, string> = {
      A: "Men",
      B: "Women",
      C: "Non-binary",
    };
    const ageBuckets = [
      { label: "18-20", min: 18, max: 20, count: 0 },
      { label: "21-23", min: 21, max: 23, count: 0 },
      { label: "24-26", min: 24, max: 26, count: 0 },
      { label: "27+", min: 27, max: 120, count: 0 },
    ];
    const genderCounts: Record<string, number> = {};
    const relationshipCounts: Record<string, number> = {};
    const openToCounts: Record<string, number> = {};
    const interestCounts: Record<string, number> = {};

    for (const profile of profiles as Array<{ id: string; age?: number | null }>) {
      const answers = answersByUser[profile.id];
      if (!answers) continue;

      const genderLabel = genderLabels[answers[16]] || "Unknown";
      const relationshipLabel = relationshipLabels[answers[18]] || "Unknown";
      genderCounts[genderLabel] = (genderCounts[genderLabel] || 0) + 1;
      relationshipCounts[relationshipLabel] = (relationshipCounts[relationshipLabel] || 0) + 1;

      const openToValues = answers[17]?.split(",").map((value) => value.trim()).filter(Boolean) || [];
      if (openToValues.length === 0) {
        openToCounts["Unknown"] = (openToCounts["Unknown"] || 0) + 1;
      } else {
        openToValues.forEach((value) => {
          const openToLabel = openToLabels[value] || value;
          openToCounts[openToLabel] = (openToCounts[openToLabel] || 0) + 1;
        });
      }

      const interests = answers[32]?.split(",").map((value) => value.trim()).filter(Boolean) || [];
      interests.forEach((interest) => {
        interestCounts[interest] = (interestCounts[interest] || 0) + 1;
      });

      if (typeof profile.age === "number") {
        const bucket = ageBuckets.find((candidate) => profile.age! >= candidate.min && profile.age! <= candidate.max);
        if (bucket) bucket.count += 1;
      }
    }

    const toChartData = (counts: Record<string, number>): ChartDatum[] =>
      Object.entries(counts)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

    const poolAnalytics = {
      genderDistribution: toChartData(genderCounts),
      sexualityDistribution: toChartData(openToCounts),
      relationshipTypeDistribution: toChartData(relationshipCounts),
      ageDistribution: ageBuckets.map(({ label, count }) => ({ label, count })),
      topInterests: toChartData(interestCounts).slice(0, 8),
    };
    const studentDomainCount = profiles.filter((p: any) => {
      const authUser = authUsersById.get(p.id);
      return isStudentEmail(authUser?.email || null);
    }).length;
    // Create dislike sets for quick lookup
    const dislikeMap: Record<string, Set<string>> = {};
    allDislikes?.forEach((dislike) => {
      if (!dislikeMap[dislike.user_id]) {
        dislikeMap[dislike.user_id] = new Set();
      }
      dislikeMap[dislike.user_id].add(dislike.disliked_user_id);
    });

    // Create like sets for quick lookup
    const likeMap: Record<string, Set<string>> = {};
    allLikes?.forEach((like: { user_id: string; liked_user_id: string }) => {
      if (!likeMap[like.user_id]) {
        likeMap[like.user_id] = new Set();
      }
      likeMap[like.user_id].add(like.liked_user_id);
    });
    const unansweredLikeRematchMap = await prepareRelationshipUnansweredLikeRematchMap(
      supabase,
      dryRun,
      (currentMatches || []) as CurrentRelationshipMatchRow[],
      likeMap,
      dislikeMap
    );

    // Debug stats initialization
    const debugStats = {
      totalCandidates: 0,
      failures: {} as Record<string, number>,
      potentialMatches: [] as any[],
      processed: false
    };
    const globalDebug = {
      totalPairsChecked: 0,
      failures: {} as Record<string, number>,
      passingPairs: 0,
      sampleFailures: [] as Array<{ user1Id: string; user2Id: string; reason: string }>,
      samplePasses: [] as Array<{ user1Id: string; user2Id: string; score?: number }>
    };
    const addGlobalFailure = (user1Id: string, user2Id: string, reason: string) => {
      globalDebug.failures[reason] = (globalDebug.failures[reason] || 0) + 1;
      if (debugAll && globalDebug.sampleFailures.length < 60) {
        globalDebug.sampleFailures.push({ user1Id, user2Id, reason });
      }
    };

    // Build bidirectional matching pairs
    // First, calculate all potential pairs with scores
    const allPotentialPairs: Array<{
      user1Id: string;
      user2Id: string;
      times_user1_previously_matched_with_user2: number;
      unanswered_like_rematch_count: number;
      score: number;
    }> = [];
    let foocount = 0;
    let foocount2 = 0;
    let foocount3 = 0;
    if (TEST_MODE) console.log("foobar start:", profiles.length)

    for (let i = 0; i < profiles.length; i++) {
      foocount += 1;

      const profile1 = profiles[i];
      const userId1 = profile1.id;

      // Skip if debug user provided and this is not the debug user loop iteration
      // (Wait, we need to check ALL pairs involving the debug user, which could be userId1 OR userId2)

      const user1Answers = answersByUser[userId1];
      if (!user1Answers) {
        foocount2 += 1;
        if (TEST_MODE) {
          console.log("No user1 answers!");
        }
        // Debug logging if this is our user
        if (debugUserId && userId1 === debugUserId) {
          debugStats.processed = true;
          debugStats.failures["No Answers"] = (debugStats.failures["No Answers"] || 0) + profiles.length;
        }
        continue;
      }

      for (let j = i + 1; j < profiles.length; j++) {
        foocount3 += 1;
        globalDebug.totalPairsChecked += 1;
        const profile2 = profiles[j];
        const userId2 = profile2.id;

        let isDebugPair = false;
        let otherUserId = "";
        if (debugUserId && (userId1 === debugUserId || userId2 === debugUserId)) {
          isDebugPair = true;
          debugStats.processed = true;
          debugStats.totalCandidates++;
          otherUserId = userId1 === debugUserId ? userId2 : userId1;
        }

        // Prevent duplicate-identity self matches:
        // block only when both full name AND age match.
        const profile1Name = normalizeName(profile1.first_name, profile1.last_name);
        const profile2Name = normalizeName(profile2.first_name, profile2.last_name);
        const sameAge = typeof profile1.age === "number" && typeof profile2.age === "number" && profile1.age === profile2.age;
        if (profile1Name !== "|" && profile1Name === profile2Name && sameAge) {
          addGlobalFailure(userId1, userId2, "Potential duplicate identity (same full name + age)");
          if (isDebugPair) {
            const reason = "Potential duplicate identity (same full name + age)";
            debugStats.failures[reason] = (debugStats.failures[reason] || 0) + 1;
          }
          continue;
        }

        const user1IsPrivileged = privilegedUserIds.has(userId1);
        const user2IsPrivileged = privilegedUserIds.has(userId2);
        if (user1IsPrivileged !== user2IsPrivileged) {
          addGlobalFailure(userId1, userId2, "Cross-group blocked (test/admin vs regular)");
          if (isDebugPair) {
            const reason = "Cross-group blocked (test/admin vs regular)";
            debugStats.failures[reason] = (debugStats.failures[reason] || 0) + 1;
          }
          continue;
        }

        const user2Answers = answersByUser[userId2];
        if (!user2Answers) {
          if (TEST_MODE) console.log("No user2 answers!");
          addGlobalFailure(userId1, userId2, "Candidate has no answers");
          if (isDebugPair) {
            const reason = "Candidate has no answers";
            debugStats.failures[reason] = (debugStats.failures[reason] || 0) + 1;
          }
          continue;
        }
        // Check if either user has disliked the other
        if (dislikeMap[userId1]?.has(userId2) || dislikeMap[userId2]?.has(userId1)) {
          if (TEST_MODE) console.log("Dislikes found");
          addGlobalFailure(userId1, userId2, "Disliked");
          if (isDebugPair) {
            const reason = "Disliked";
            debugStats.failures[reason] = (debugStats.failures[reason] || 0) + 1;
          }
          continue;
        }
        const unansweredLikeRematchCount = getPairUnansweredLikeRematchCount(unansweredLikeRematchMap, userId1, userId2);
        if (unansweredLikeRematchCount >= MAX_UNANSWERED_LIKE_REMATCHES) {
          addGlobalFailure(userId1, userId2, "Unanswered-like rematch limit reached");
          if (isDebugPair) {
            const reason = "Unanswered-like rematch limit reached";
            debugStats.failures[reason] = (debugStats.failures[reason] || 0) + 1;
          }
          continue;
        }
        // Campus-only mode: do not gate weekly dating matches by geolocation distance.
        const distance = (profile1.latitude && profile1.longitude && profile2.latitude && profile2.longitude)
          ? calculateDistance(profile1.latitude, profile1.longitude, profile2.latitude, profile2.longitude)
          : null;
        // Check dealbreakers
        const dealbreakerCheck = passesDealbreakerChecks(user1Answers, user2Answers, profile1.age, profile2.age);
        if (!dealbreakerCheck.pass) {
          if (TEST_MODE) console.log("Some dealbreaker found with user1:", userId1, "user2:", userId2);
          addGlobalFailure(userId1, userId2, dealbreakerCheck.reason || "Unknown Dealbreaker");
          if (isDebugPair) {
            const reason = dealbreakerCheck.reason || "Unknown Dealbreaker";
            debugStats.failures[reason] = (debugStats.failures[reason] || 0) + 1;
          }
          continue;
        }
        // Calculate compatibility score
        let score = calculateCompatibilityScore(user1Answers, user2Answers);

        // Skip if compatibility score is below 0.3 threshold
        if (score < 0.3) {
          if (TEST_MODE) console.log(`Score too low: ${score.toFixed(2)} for ${userId1}-${userId2}`);
          addGlobalFailure(userId1, userId2, "Score too low (< 30%)");
          if (isDebugPair) {
            const reason = `Score too low (< 30%)`;
            debugStats.failures[reason] = (debugStats.failures[reason] || 0) + 1;
          }
          continue;
        }

        // Boost score based on user activity (more active users get higher scores)
        const user1DaysSinceSignIn = userActivityMap[userId1] ?? 999;
        const user2DaysSinceSignIn = userActivityMap[userId2] ?? 999;
        const avgDaysSinceSignIn = (user1DaysSinceSignIn + user2DaysSinceSignIn) / 2;

        let activityBoost = 1.0;
        if (avgDaysSinceSignIn <= 7) {
          activityBoost = 1.15; // 15% boost for very active users (within 7 days)
        } else if (avgDaysSinceSignIn <= 14) {
          activityBoost = 1.10; // 10% boost for active users (within 14 days)
        } else if (avgDaysSinceSignIn <= 30) {
          activityBoost = 1.05; // 5% boost for moderately active users (within 30 days)
        }

        score = score * activityBoost;
        if (TEST_MODE && activityBoost > 1.0) {
          console.log(`Activity boost: ${activityBoost}x for ${userId1}-${userId2} (avg ${avgDaysSinceSignIn.toFixed(1)} days since sign in)`);
        }

        if (TEST_MODE) console.log(`Found match: ${userId1}-${userId2} with final score ${score.toFixed(2)}`);

        if (isDebugPair) {
          debugStats.potentialMatches.push({
            otherUserId,
            score,
            rawScore: score / activityBoost,
            boost: activityBoost,
            distance
          });
        }
        globalDebug.passingPairs += 1;
        if (debugAll && globalDebug.samplePasses.length < 60) {
          globalDebug.samplePasses.push({
            user1Id: userId1,
            user2Id: userId2,
            score
          });
        }

        allPotentialPairs.push({
          user1Id: userId1,
          user2Id: userId2,
          times_user1_previously_matched_with_user2: userMatchCounts[userId1]?.[userId2] || 0,
          unanswered_like_rematch_count: unansweredLikeRematchCount,
          score
        });
      }
    }
    console.log("Profiles 1 outer loop:", foocount, "Profiles 1 skipped:", foocount2, "Profiles 2 loop:", foocount3, "age errors:", ageerrors);

    // Find the smallest value of 'times_user1_previously_matched_with_user2' for each pair
    const minUserMatches: Record<string, number> = {}
    const foobar: Record<string, number> = {}
    allPotentialPairs.forEach((pair) => {
      if (!minUserMatches[pair.user1Id]) minUserMatches[pair.user1Id] = Infinity
      minUserMatches[pair.user1Id] = Math.min(minUserMatches[pair.user1Id], pair.times_user1_previously_matched_with_user2)

      if (!minUserMatches[pair.user2Id]) minUserMatches[pair.user2Id] = Infinity
      minUserMatches[pair.user2Id] = Math.min(minUserMatches[pair.user2Id], pair.times_user1_previously_matched_with_user2)

      foobar[pair.user1Id] = (foobar[pair.user1Id] || 0) + 1
      foobar[pair.user2Id] = (foobar[pair.user2Id] || 0) + 1
    })

    const potentialCountByUser: Record<string, number> = {};
    for (const pair of allPotentialPairs) {
      potentialCountByUser[pair.user1Id] = (potentialCountByUser[pair.user1Id] || 0) + 1;
      potentialCountByUser[pair.user2Id] = (potentialCountByUser[pair.user2Id] || 0) + 1;
    }
    // Coverage order: prioritize scarce users first, then favor new pairs over repeats.
    const coverageOrderPairs = [...allPotentialPairs].sort((a, b) => {
      const aMin = Math.min(potentialCountByUser[a.user1Id] || 0, potentialCountByUser[a.user2Id] || 0);
      const bMin = Math.min(potentialCountByUser[b.user1Id] || 0, potentialCountByUser[b.user2Id] || 0);
      const aSum = (potentialCountByUser[a.user1Id] || 0) + (potentialCountByUser[a.user2Id] || 0);
      const bSum = (potentialCountByUser[b.user1Id] || 0) + (potentialCountByUser[b.user2Id] || 0);
      return (aMin - bMin)
        || (aSum - bSum)
        || (a.unanswered_like_rematch_count - b.unanswered_like_rematch_count)
        || (a.times_user1_previously_matched_with_user2 - b.times_user1_previously_matched_with_user2)
        || (b.score - a.score);
    });
    // Track how many pairs each user is in
    const userPairCount: Record<string, number> = {};
    const selectedPairKeys = new Set<string>();
    const selectedPairs: Array<{
      user1Id: string;
      user2Id: string;
      times_user1_previously_matched_with_user2: number;
      unanswered_like_rematch_count: number;
      score: number;
    }> = [];

    const canSelectPair = (pair: {
      user1Id: string;
      user2Id: string;
      times_user1_previously_matched_with_user2: number;
      unanswered_like_rematch_count: number;
      score: number;
    }) => {
      const pairKey = [pair.user1Id, pair.user2Id].sort().join("|");
      if (selectedPairKeys.has(pairKey)) return false;
      const user1Count = userPairCount[pair.user1Id] || 0;
      const user2Count = userPairCount[pair.user2Id] || 0;
      if (user1Count >= MAX_WEEKLY_MATCHES_PER_USER || user2Count >= MAX_WEEKLY_MATCHES_PER_USER) {
        return false;
      }
      return true;
    };

    const selectPair = (pair: {
      user1Id: string;
      user2Id: string;
      times_user1_previously_matched_with_user2: number;
      unanswered_like_rematch_count: number;
      score: number;
    }) => {
      const pairKey = [pair.user1Id, pair.user2Id].sort().join("|");
      const user1Count = userPairCount[pair.user1Id] || 0;
      const user2Count = userPairCount[pair.user2Id] || 0;
      selectedPairs.push(pair);
      userPairCount[pair.user1Id] = user1Count + 1;
      userPairCount[pair.user2Id] = user2Count + 1;
      selectedPairKeys.add(pairKey);
    };

    // Round-based coverage priority for all rounds:
    // round 1 gives first matches broadly; round 2 gives second matches broadly; ... up to cap.
    for (let round = 1; round <= MAX_WEEKLY_MATCHES_PER_USER; round++) {
      for (const pair of coverageOrderPairs) {
        if (!canSelectPair(pair)) continue;
        const c1 = userPairCount[pair.user1Id] || 0;
        const c2 = userPairCount[pair.user2Id] || 0;
        if (c1 < round && c2 < round) {
          outstring += "User1 has " + foobar[pair.user1Id] + " potential matches";
          selectPair(pair);
        }
      }
    }
    if (TEST_MODE) console.log(`Selected ${selectedPairs.length} bidirectional pairs`);

    let totalMatchesCreated = 0;
    const profileMap = new Map<string, Profile>(profiles.map((p: any) => [p.id, p]));
    const formatOpenTo = (value?: string) => {
      if (!value) return "Unknown";
      const items = value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => openToLabels[v] || v);
      return items.length > 0 ? items.join(", ") : "Unknown";
    };
    type genderValue = {
      [key: string]: string;
    }
    const genderValues: genderValue = {
      'A': "Woman",
      'B': "Man",
      'C': "Non-binary",
      'D': "Prefer not to say",
    }
    const runResults = selectedPairs.map(pair => ({
      user1_id: pair.user1Id,
      user2_id: pair.user2Id,
      user1_gender: genderValues[answersByUser[pair.user1Id][16]],
      user2_gender: genderValues[answersByUser[pair.user2Id][16]],
      user1_open_to_dating: formatOpenTo(answersByUser[pair.user1Id][17]),
      user2_open_to_dating: formatOpenTo(answersByUser[pair.user2Id][17]),
      user1_name: profileMap.get(pair.user1Id)?.first_name,
      user2_name: profileMap.get(pair.user2Id)?.first_name,
      // Display canonical auth email (student-gated source) to avoid stale profile.email.
      user1_email: authUsersById.get(pair.user1Id)?.email || profileMap.get(pair.user1Id)?.email,
      user2_email: authUsersById.get(pair.user2Id)?.email || profileMap.get(pair.user2Id)?.email,
      user1_options: foobar[pair.user1Id],
      user2_options: foobar[pair.user2Id],
      times_user1_matched_user2: pair.times_user1_previously_matched_with_user2,
      user1_min: minUserMatches[pair.user1Id],
      user2_min: minUserMatches[pair.user2Id],
      user1_liked_user2: likeMap[pair.user1Id]?.has(pair.user2Id) || false,
      user2_liked_user1: likeMap[pair.user2Id]?.has(pair.user1Id) || false,
      unanswered_like_rematch_count: pair.unanswered_like_rematch_count,
      compatibility_score: Math.round(pair.score)
    }));
    const mondayDropPreview = runResults.slice(0, previewLimit).map((r) => ({
      user1_name: r.user1_name,
      user1_email: r.user1_email,
      user1_gender: r.user1_gender,
      user1_open_to_dating: r.user1_open_to_dating,
      user2_name: r.user2_name,
      user2_email: r.user2_email,
      user2_gender: r.user2_gender,
      user2_open_to_dating: r.user2_open_to_dating,
      compatibility_score: r.compatibility_score,
      match_type: "relationship",
      user1_liked_user2: r.user1_liked_user2,
      user2_liked_user1: r.user2_liked_user1
    }));

    // Run friendship matching via match-users so daily-cron can maintain both pipelines.
    // This runs in dry-run and real mode; match-users respects the dry-run header.
    let friendshipOutputMatches: any[] = [];
    let friendshipInvokeSummary: Record<string, unknown> | null = null;
    let friendshipInvokeErrorMessage: string | null = null;
    try {
      const internalCronSecret = cronSecret || providedSecret || undefined;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (!supabaseAnonKey) {
        throw new Error("SUPABASE_ANON_KEY is not configured for internal friendship invoke");
      }

      const friendshipHeaders: Record<string, string> = {
        "apikey": supabaseAnonKey,
        "x-algorithm": "friendship",
        "dry-run": dryRun ? "true" : "false",
        "x-send-emails": dryRun ? "false" : "true",
        "x-max-matches-per-user": String(FRIENDSHIP_MAX_WEEKLY_MATCHES_PER_USER),
        "Content-Type": "application/json",
      };
      if (internalCronSecret) {
        friendshipHeaders["X-Cron-Secret"] = internalCronSecret;
      }

      const friendshipResponse = await fetch(`${supabaseUrl}/functions/v1/match-users`, {
        method: "POST",
        headers: friendshipHeaders,
        body: JSON.stringify({ debug_user_id: debugUserId || undefined }),
      });

      const friendshipText = await friendshipResponse.text();
      if (!friendshipResponse.ok) {
        throw new Error(`match-users friendship dry-run failed (${friendshipResponse.status}): ${friendshipText || friendshipResponse.statusText}`);
      }

      const parsedFriendshipData = friendshipText ? JSON.parse(friendshipText) : null;

      if (parsedFriendshipData?.error) {
        throw new Error(parsedFriendshipData.error);
      }

      friendshipOutputMatches = parsedFriendshipData?.matches || [];
      friendshipInvokeSummary = {
        success: parsedFriendshipData?.success ?? true,
        message: parsedFriendshipData?.message ?? null,
        selectedMatches: friendshipOutputMatches.length,
        candidateMatches: Array.isArray(parsedFriendshipData?.candidates) ? parsedFriendshipData.candidates.length : null,
      };
    } catch (friendshipRunError) {
      console.error("Friendship matching run failed inside daily-cron:", friendshipRunError);
      friendshipInvokeErrorMessage = friendshipRunError instanceof Error
        ? friendshipRunError.message
        : String(friendshipRunError);
    }

    const friendshipPreviewRows = friendshipOutputMatches.slice(0, previewLimit).map((r: any) => ({
      user1_name: r.user1_name,
      user1_email: r.user1_email,
      user1_gender: r.user1_gender,
      user1_open_to_dating: "No romantic open-to answer",
      user2_name: r.user2_name,
      user2_email: r.user2_email,
      user2_gender: r.user2_gender,
      user2_open_to_dating: "No romantic open-to answer",
      compatibility_score: r.compatibility_score,
      match_type: "friendship",
      user1_liked_user2: r.user1_liked_user2,
      user2_liked_user1: r.user2_liked_user1,
    }));

    // Keep preview bounded while showing both types.
    const combinedPreview = [...mondayDropPreview, ...friendshipPreviewRows].slice(0, previewLimit);
    const friendshipMatchesWouldCreate = friendshipOutputMatches.length * 2;
    const romanticMatchesWouldCreate = selectedPairs.length * 2;
    const totalMatchesWouldCreateAll = romanticMatchesWouldCreate + friendshipMatchesWouldCreate;
    const failureBreakdown = Object.entries(globalDebug.failures)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
    const averageCompatibilityScore = runResults.length > 0
      ? Math.round(runResults.reduce((sum, row) => sum + (row.compatibility_score || 0), 0) / runResults.length)
      : 0;
    const keyMetrics = [
      { label: "Eligible Before Feedback Gate", value: usersBeforeFeedbackGate },
      { label: "Blocked By Feedback Gate", value: feedbackGateBlockedCount },
      { label: "Eligible After Feedback Gate", value: profiles.length },
      { label: "Student-Domain Users In Pool", value: studentDomainCount },
      { label: "Pairs Checked", value: globalDebug.totalPairsChecked },
      { label: "Pairs Passing Core Filters", value: globalDebug.passingPairs },
      { label: "Preview Pairs For Monday", value: combinedPreview.length },
      { label: "Romantic Matches Would Be Created", value: romanticMatchesWouldCreate },
      { label: "Friendship Matches Would Be Created", value: friendshipMatchesWouldCreate },
      { label: "Total Matches Would Be Created", value: totalMatchesWouldCreateAll },
      { label: "Avg Compatibility (Preview)", value: averageCompatibilityScore },
    ];

    if (dryRun) {
      // Dry-run mode: just return the results without updating the database
      console.log(`DRY-RUN: Would create ${selectedPairs.length * 2} matches (${selectedPairs.length} bidirectional pairs)`);

      return new Response(JSON.stringify({
        success: true,
        dryRun: true,
        message: "Dry-run completed - no database changes made",
        timestamp: new Date().toISOString(),
        usersBeforeFeedbackGate,
        feedbackGateBlockedCount,
        usersAfterFeedbackGate: profiles.length,
        debugUserBlockedByFeedbackGate: debugUserId ? debugUserBlockedByFeedbackGate : undefined,
        usersProcessed: profiles.length,
        pairsFound: selectedPairs.length,
        totalMatchesWouldCreate: totalMatchesWouldCreateAll,
        mondayDropPreviewCount: combinedPreview.length,
        mondayDropTotalPairs: combinedPreview.length,
        mondayDropPreview: combinedPreview,
        friendshipMatchesWouldCreate,
        friendshipInvokeSummary,
        friendshipInvokeError: friendshipInvokeErrorMessage,
        romanticMatchesWouldCreate,
        failureBreakdown,
        keyMetrics,
        poolAnalytics,
        debugStats: !compact && debugUserId ? debugStats : undefined,
        debugAll: !compact && debugAll ? globalDebug : undefined,
        matches: !compact ? runResults : undefined
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    }

    // Normal mode: update the relationship matching dataset for this run.
    // Keep friendship matches intact (friendship pipeline manages its own rows).
    await supabase.from("matches").delete().eq("from_algorithm", "relationship");

    // Track which users got new matches for email notifications
    const usersWithNewMatches = new Map<string, Array<{ matchedUserId: string, score: number }>>();

    // Insert bidirectional matches for each pair
    for (const pair of selectedPairs) {
      const matchesToInsert = [
        {
          user_id: pair.user1Id,
          matched_user_id: pair.user2Id,
          compatibility_score: Math.round(pair.score),
          from_algorithm: 'relationship',
          match_type: 'relationship'
        },
        {
          user_id: pair.user2Id,
          matched_user_id: pair.user1Id,
          compatibility_score: Math.round(pair.score),
          from_algorithm: 'relationship',
          match_type: 'relationship'
        }
      ];
      const { error: insertError } = await supabase.from("matches").insert(matchesToInsert);
      if (insertError) {
        console.error(`Error inserting match pair (${pair.user1Id}, ${pair.user2Id}):`, insertError);
      } else {
        totalMatchesCreated += 2;
        if (TEST_MODE) console.log(`Created bidirectional match between ${pair.user1Id} and ${pair.user2Id} (score: ${Math.round(pair.score)})`);

        // Track for email notifications
        if (!usersWithNewMatches.has(pair.user1Id)) {
          usersWithNewMatches.set(pair.user1Id, []);
        }
        if (!usersWithNewMatches.has(pair.user2Id)) {
          usersWithNewMatches.set(pair.user2Id, []);
        }
        usersWithNewMatches.get(pair.user1Id)!.push({ matchedUserId: pair.user2Id, score: Math.round(pair.score) });
        usersWithNewMatches.get(pair.user2Id)!.push({ matchedUserId: pair.user1Id, score: Math.round(pair.score) });

        // Insert into match_history for historical tracking
        const historyRecords = [
          {
            user_id: pair.user1Id,
            matched_user_id: pair.user2Id,
            compatibility_score: Math.round(pair.score),
            from_algorithm: 'relationship',
            match_type: 'relationship'
          },
          {
            user_id: pair.user2Id,
            matched_user_id: pair.user1Id,
            compatibility_score: Math.round(pair.score),
            from_algorithm: 'relationship',
            match_type: 'relationship'
          }
        ];
        const { error: historyError } = await supabase.from("match_history").insert(historyRecords);
        if (historyError) {
          console.error(`Error inserting match history for pair (${pair.user1Id}, ${pair.user2Id}):`, historyError);
        }
      }
    }

    // Send email notifications to users with new matches
    const sendEmail = true
    if (!dryRun && sendEmail && runResults.length > 0) {
      sendMatchNotificationEmails(supabase, runResults, providedSecret!);
    }

    console.log(`Daily cron job completed. Total romantic matches created by daily-cron: ${totalMatchesCreated}. Friendship handled by match-users.`);
    return new Response(JSON.stringify({
      success: true,
      dryRun: false,
      message: "Daily match calculation completed",
      timestamp: new Date().toISOString(),
      usersBeforeFeedbackGate,
      feedbackGateBlockedCount,
      usersAfterFeedbackGate: profiles.length,
      debugUserBlockedByFeedbackGate: debugUserId ? debugUserBlockedByFeedbackGate : undefined,
      usersProcessed: profiles.length,
      totalMatchesCreated,
      matches: runResults,
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (error) {
    console.error("Error in daily-cron function:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});

// Calculate distance between two coordinates in miles using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
// Check if two users pass dealbreaker criteria
function passesDealbreakerChecks(
  user1Answers: Record<number, string>,
  user2Answers: Record<number, string>,
  user1Age: number,
  user2Age: number,
): { pass: boolean; reason?: string } {
  // Question 16: Gender identity
  const user1Gender = user1Answers[16];
  const user2Gender = user2Answers[16];
  // Question 17: Open to dating (multi-select)
  const user1OpenTo = user1Answers[17]?.split(",") || [];
  const user2OpenTo = user2Answers[17]?.split(",") || [];
  // Map gender to dating preference values
  const genderToDatingPref: Record<string, string> = {
    A: "B", // Woman -> open to women
    B: "A", // Man -> open to men
    C: "C", // Non-binary -> open to non-binary
  };
  // Check if user1 is open to user2's gender and vice versa
  const user1Pref = genderToDatingPref[user2Gender];
  const user2Pref = genderToDatingPref[user1Gender];
  if (user1Pref && !user1OpenTo.includes(user1Pref)) {
    if (TEST_MODE) console.log("Dealbreaker: 16/17 user1 not open to user2 gender");
    return { pass: false, reason: "Gender preference (User 1 not open to User 2)" };
  }
  if (user2Pref && !user2OpenTo.includes(user2Pref)) {
    if (TEST_MODE) console.log("Dealbreaker: 16/17 user2 not opento user1 gender");
    return { pass: false, reason: "Gender preference (User 2 not open to User 1)" };
  }
  // Question 18: Relationship type must match exactly
  if (user1Answers[18] !== user2Answers[18]) {
    if (TEST_MODE) console.log("Dealbreaker: 18 relationship looking for not matched exactly");
    return { pass: false, reason: "Relationship type mismatch" };
  }
  // Question 20: Age range preferences
  const user1AgeRange = user1Answers[20]?.split(":").map(Number) || [
    18,
    99
  ];
  const user2AgeRange = user2Answers[20]?.split(":").map(Number) || [
    18,
    99
  ];
  if (user2Age < user1AgeRange[0] || user2Age > user1AgeRange[1]) {
    if (!user2Age) {
      ageerrors += 1
    }
    if (TEST_MODE) console.log("Dealbreaker: 20 user2 age outside user1 range");
    return { pass: false, reason: "Age (User 2 outside User 1 range)" };
  }
  if (user1Age < user2AgeRange[0] || user1Age > user2AgeRange[1]) {
    if (!user1Age) {
      ageerrors += 1
    }
    if (TEST_MODE) console.log("Dealbreaker: 20 user1 age outside user2 range");
    return { pass: false, reason: "Age (User 1 outside User 2 range)" };
  }
  // Question 21 & 22: Smoking/Drinking/Drugs dealbreakers
  const user1Does = user1Answers[21]?.split(",") || [];
  const user2Does = user2Answers[21]?.split(",") || [];
  const user1Dealbreakers = user1Answers[22]?.split(",") || [];
  const user2Dealbreakers = user2Answers[22]?.split(",") || [];
  // Check if user1 does something that is a dealbreaker for user2
  for (const habit of user1Does) {
    if (user2Dealbreakers.includes(habit)) {
      if (TEST_MODE) console.log("Dealbreaker: 21/22 user2 cant accept user1 habit ", user2Dealbreakers, habit);
      return { pass: false, reason: `Habit dealbreaker (User 2 dislikes ${habit})` };
    }
  }
  // Check if user2 does something that is a dealbreaker for user1
  for (const habit of user2Does) {
    if (user1Dealbreakers.includes(habit)) {
      if (TEST_MODE) console.log("Dealbreaker: 21/22 user1 cant accept user2 habit ", user1Dealbreakers, habit);
      return { pass: false, reason: `Habit dealbreaker (User 1 dislikes ${habit})` };
    }
  }
  // Question 25: Languages - must have at least one in common
  const user1Languages = user1Answers[25]?.split(",") || [];
  const user2Languages = user2Answers[25]?.split(",") || [];
  const hasCommonLanguage = user1Languages.some((lang) => user2Languages.includes(lang));
  if (!hasCommonLanguage) {
    if (TEST_MODE) console.log("Dealbreaker: 25 dont have a language in common ", user1Languages, user2Languages);
    return { pass: false, reason: "No common language" };
  }
  // Question 26 & 27: Cultural background preference
  if (user1Answers[26] === "A") {
    // User1 cares about similar culture
    const user1Culture = user1Answers[27]?.split(",") || [];
    const user2Culture = user2Answers[27]?.split(",") || [];
    const hasCommonCulture = user1Culture.some((c) => user2Culture.includes(c));
    if (!hasCommonCulture) {
      if (TEST_MODE) console.log("Dealbreaker: 26/27 user1 cares about sharing culture, user2 doesn't have ", user1Culture, user2Culture);
      return { pass: false, reason: "Culture mismatch (User 1 requirement)" };
    }
  }
  if (user2Answers[26] === "A") {
    // User2 cares about similar culture
    const user1Culture = user1Answers[27]?.split(",") || [];
    const user2Culture = user2Answers[27]?.split(",") || [];
    const hasCommonCulture = user1Culture.some((c) => user2Culture.includes(c));
    if (!hasCommonCulture) {
      if (TEST_MODE) console.log("Dealbreaker: 26/27 user2 cares about sharing culture, user1 doesn't have ", user1Culture, user2Culture);
      return { pass: false, reason: "Culture mismatch (User 2 requirement)" };
    }
  }
  // Question 29: Religion importance
  if (user1Answers[29] === "A") {
    // User1 wants same religion
    if (user1Answers[28] !== user2Answers[28]) {
      if (TEST_MODE) console.log("Dealbreaker: 28/29 user1 wants same religion ", user1Answers[28], user2Answers[28]);
      return { pass: false, reason: "Religion mismatch (User 1 requirement)" };
    }
  }
  if (user2Answers[29] === "A") {
    // User2 wants same religion
    if (user1Answers[28] !== user2Answers[28]) {
      if (TEST_MODE) console.log("Dealbreaker: 28/29 user2 wants same religion ", user1Answers[28], user2Answers[28]);
      return { pass: false, reason: "Religion mismatch (User 2 requirement)" };
    }
  }
  // Question 31: Political views preference
  if (user1Answers[31] === "A") {
    // User1 wants similar politics
    if (user1Answers[30] !== user2Answers[30]) {
      if (TEST_MODE) console.log("Dealbreaker: 30/31 user1 wants same politics ", user1Answers[30], user2Answers[30]);
      return { pass: false, reason: "Politics mismatch (User 1 requirement)" };
    }
  }
  if (user2Answers[31] === "A") {
    // User2 wants similar politics
    if (user1Answers[30] !== user2Answers[30]) {
      if (TEST_MODE) console.log("Dealbreaker: 30/31 user2 wants same politics ", user1Answers[30], user2Answers[30]);
      return { pass: false, reason: "Politics mismatch (User 2 requirement)" };
    }
  }
  // Question 33: Shared interests requirement
  if (user1Answers[33] === "A" || user2Answers[33] === "A") {
    const user1Interests = user1Answers[32]?.split(",") || [];
    const user2Interests = user2Answers[32]?.split(",") || [];
    const hasSharedInterest = user1Interests.some((i) => user2Interests.includes(i));
    if (!hasSharedInterest) {
      if (TEST_MODE) console.log("Dealbreaker: 32/33 users don't share an interest but want to", user1Interests, user2Interests);
      return { pass: false, reason: "No shared interests" };
    }
  }
  if (TEST_MODE) console.log("No dealbreakers found!");
  return { pass: true };
}
// Calculate compatibility score based on non-dealbreaker questions
function calculateCompatibilityScore(
  user1Answers: Record<number, string>,
  user2Answers: Record<number, string>,
): number {
  let totalScore = 0;
  let questionsCompared = 0;
  // Question weights based on importance
  const questionWeights: Record<number, number> = {
    2: 3, // Perfect day
    4: 3, // Friday night
    5: 2, // Spontaneity
    6: 4, // Communication style
    7: 3, // Support needs
    8: 4, // Closeness preference
    9: 4, // Independence vs closeness
    10: 3, // Emotional awareness
    11: 3, // Attachment speed
    12: 3, // Anxiety about communication
    13: 4, // Time together preference
    14: 3, // Sexual connection importance
    15: 2, // Love language
    19: 3, // Kids preference
    32: 5, // Shared interests
    34: 2, // First date preferences
    35: 5, // Personal values
    36: 5, // Partner qualities
  };
  for (const [questionNum, weight] of Object.entries(questionWeights)) {
    const qNum = parseInt(questionNum);
    const ans1 = user1Answers[qNum];
    const ans2 = user2Answers[qNum];
    if (!ans1 || !ans2) continue;
    questionsCompared++;
    // For multi-select questions, calculate overlap
    if ([
      32,
      34,
      35,
      36
    ].includes(qNum)) {
      const set1 = ans1.split(",");
      const set2 = ans2.split(",");
      const overlap = set1.filter((v) => set2.includes(v)).length;
      const total = new Set([
        ...set1,
        ...set2
      ]).size;
      const similarity = total > 0 ? overlap / total : 0;
      totalScore += similarity * weight * 100;
    } else {
      // For single-select questions, exact match gives full points
      if (ans1 === ans2) {
        totalScore += weight * 100;
      } else {
        // Partial credit for similar answers on some questions
        if (qNum === 13 && Math.abs(ans1.charCodeAt(0) - ans2.charCodeAt(0)) === 1) {
          totalScore += weight * 50; // Adjacent time preference
        } else if (qNum === 14 && Math.abs(ans1.charCodeAt(0) - ans2.charCodeAt(0)) === 1) {
          totalScore += weight * 50; // Adjacent sexual connection importance
        }
      }
    }
  }
  // Return percentage score
  const maxPossibleScore = Object.values(questionWeights).reduce((a, b) => a + b, 0) * 100;
  return questionsCompared > 0 ? totalScore / maxPossibleScore * 100 : 0;
}
