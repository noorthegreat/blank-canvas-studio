/*
One-time matcher function I created for use in a SRF event.
It manually takes a bunch of men and women and creates compatibility scores for each possible pair.
*/
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateEdgeRequest } from "../_shared/auth.ts";

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
  last_name: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
}

interface EventMatchRequest {
  womenEmails: string[];
  menEmails: string[];
  topN: number;
  fullCompatibilityMatrix?: boolean; // If true, returns all man-woman compatibility scores instead of matches
}

interface WomanMatch {
  womanEmail: string;
  womanName: string;
  manEmail: string;
  manName: string;
  compatibilityScore: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`The event matcher started at: ${new Date().toISOString()}`);

    const auth = await authenticateEdgeRequest(req, { requireAdmin: true });
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error.message }), {
        status: auth.error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = auth.context!.supabase;

    // Parse request body
    const { womenEmails, menEmails, topN, fullCompatibilityMatrix }: EventMatchRequest = await req.json();

    if (!womenEmails || !menEmails || !topN) {
      return new Response(JSON.stringify({
        error: "Missing required fields: womenEmails, menEmails, topN"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Matching ${menEmails.length} men with ${womenEmails.length} women, selecting top ${topN}`);

    // Resolve emails → user_ids via private_profile_data, then fetch profiles
    const allEmails = [...womenEmails, ...menEmails];
    const { data: privateByEmail } = await supabase
      .from("private_profile_data")
      .select("user_id, email, last_name, latitude, longitude")
      .in("email", allEmails);

    const privateEmailMap = new Map((privateByEmail || []).map((r: any) => [r.email, r]));
    const privateUserMap = new Map((privateByEmail || []).map((r: any) => [r.user_id, r]));

    const womenIds = womenEmails.map((e: string) => privateEmailMap.get(e)?.user_id).filter(Boolean);
    const menIds = menEmails.map((e: string) => privateEmailMap.get(e)?.user_id).filter(Boolean);

    const [{ data: womenBase, error: womenError }, { data: menBase, error: menError }] = await Promise.all([
      supabase.from("profiles").select("id, age, first_name, latitude, longitude").in("id", womenIds),
      supabase.from("profiles").select("id, age, first_name, latitude, longitude").in("id", menIds),
    ]);

    if (womenError) throw womenError;
    if (menError) throw menError;

    const mergePrivate = (p: any) => {
      const priv = privateUserMap.get(p.id);
      return {
        ...p,
        last_name: priv?.last_name ?? null,
        email: priv?.email ?? null,
        latitude: p.latitude ?? priv?.latitude ?? null,
        longitude: p.longitude ?? priv?.longitude ?? null,
      };
    };

    const womenProfiles = (womenBase || []).map(mergePrivate);
    const menProfiles = (menBase || []).map(mergePrivate);

    console.log(`Found ${womenProfiles?.length} women and ${menProfiles?.length} men`);

    if (!womenProfiles || womenProfiles.length === 0) {
      return new Response(JSON.stringify({
        error: "No women profiles found for provided emails"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!menProfiles || menProfiles.length === 0) {
      return new Response(JSON.stringify({
        error: "No men profiles found for provided emails"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get all user IDs
    const allUserIds = [...womenProfiles.map(p => p.id), ...menProfiles.map(p => p.id)];

    // Fetch personality answers for all users
    const { data: answersData, error: answersError } = await supabase
      .from("personality_answers")
      .select("user_id, question_number, answer, answer_custom")
      .in("user_id", allUserIds);

    if (answersError) throw answersError;

    console.log(`Fetched ${answersData?.length} personality answers`);

    // Organize answers by user
    const answersByUser = new Map<string, Record<number, string>>();
    answersData?.forEach((answer) => {
      if (!answersByUser.has(answer.user_id)) {
        answersByUser.set(answer.user_id, {});
      }
      const userAnswers = answersByUser.get(answer.user_id)!;
      userAnswers[answer.question_number] = answer.answer;
    });

    // Calculate compatibility scores between each woman and each man
    interface WomanScores {
      womanEmail: string;
      womanName: string;
      womanId: string;
      compatibleMen: Array<{
        manEmail: string;
        manName: string;
        manId: string;
        score: number;
      }>;
      incompatibleMen: Array<{
        manEmail: string;
        manName: string;
        reasons: string[];
      }>;
    }

    const womenScores: WomanScores[] = [];

    for (const woman of womenProfiles) {
      const womanAnswers = answersByUser.get(woman.id) || {};
      const compatibleMen: Array<{ manEmail: string; manName: string; manId: string; score: number }> = [];
      const incompatibleMen: Array<{ manEmail: string; manName: string; reasons: string[] }> = [];

      for (const man of menProfiles) {
        const manAnswers = answersByUser.get(man.id) || {};

        // Check hard dealbreakers (gender and language only)
        const hardDealbreakerResult = passesHardDealbreakers(
          manAnswers,
          womanAnswers
        );

        if (hardDealbreakerResult !== true) {
          console.log(`Man ${man.email} fails hard dealbreakers with woman ${woman.email}: ${hardDealbreakerResult.reasons.join(", ")}`);
          incompatibleMen.push({
            manEmail: man.email,
            manName: `${man.first_name} ${man.last_name || ''}`.trim(),
            reasons: hardDealbreakerResult.reasons
          });
          continue;
        }

        // Calculate base compatibility score
        const baseScore = calculateCompatibilityScore(manAnswers, womanAnswers);

        // Calculate soft dealbreaker penalty
        const penalty = calculateDealbreakerPenalty(
          manAnswers,
          womanAnswers,
          man.age,
          woman.age
        );

        // Final score is base score minus penalty (minimum 0)
        const finalScore = Math.max(0, baseScore - penalty);

        compatibleMen.push({
          manEmail: man.email,
          manName: `${man.first_name} ${man.last_name || ''}`.trim(),
          manId: man.id,
          score: Math.round(finalScore * 10) / 10
        });
      }

      // Sort men by compatibility score for this woman (highest first)
      compatibleMen.sort((a, b) => b.score - a.score);

      womenScores.push({
        womanEmail: woman.email,
        womanName: `${woman.first_name} ${woman.last_name || ''}`.trim(),
        womanId: woman.id,
        compatibleMen,
        incompatibleMen
      });
    }

    console.log(`Calculated compatibility scores for ${womenScores.length} women`);

    // If fullCompatibilityMatrix is enabled, return all compatibility scores instead of matches
    if (fullCompatibilityMatrix) {
      interface CompatibilityMatrixEntry {
        womanEmail: string;
        womanName: string;
        manEmail: string;
        manName: string;
        compatibilityScore: number;
        passesHardDealbreakers: boolean;
        hardDealbreakerReasons?: string[];
      }

      const compatibilityMatrix: CompatibilityMatrixEntry[] = [];

      for (const womanScore of womenScores) {
        // Add all compatible men
        for (const man of womanScore.compatibleMen) {
          compatibilityMatrix.push({
            womanEmail: womanScore.womanEmail,
            womanName: womanScore.womanName,
            manEmail: man.manEmail,
            manName: man.manName,
            compatibilityScore: man.score,
            passesHardDealbreakers: true
          });
        }

        // Add incompatible men with their reasons
        for (const man of womanScore.incompatibleMen) {
          compatibilityMatrix.push({
            womanEmail: womanScore.womanEmail,
            womanName: womanScore.womanName,
            manEmail: man.manEmail,
            manName: man.manName,
            compatibilityScore: 0,
            passesHardDealbreakers: false,
            hardDealbreakerReasons: man.reasons
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        compatibilityMatrix,
        stats: {
          totalMenEvaluated: menProfiles.length,
          totalWomen: womenProfiles.length,
          totalPairs: compatibilityMatrix.length,
          pairsPassingHardDealbreakers: compatibilityMatrix.filter(p => p.passesHardDealbreakers).length
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    // Greedy matching algorithm: assign each woman to her best available man
    const matches: WomanMatch[] = [];
    const unmatchedWomen: Array<{
      email: string;
      name: string;
      reason: string;
      incompatibleMen?: Array<{
        manEmail: string;
        manName: string;
        reasons: string[];
      }>;
    }> = [];
    const matchedMenIds = new Set<string>();

    // Sort women by the score of their top match (descending) to prioritize women with better matches
    womenScores.sort((a, b) => {
      const aTopScore = a.compatibleMen.length > 0 ? a.compatibleMen[0].score : 0;
      const bTopScore = b.compatibleMen.length > 0 ? b.compatibleMen[0].score : 0;
      return bTopScore - aTopScore;
    });

    for (const womanScore of womenScores) {
      // Find the best man for this woman who hasn't been matched yet
      const bestAvailableMan = womanScore.compatibleMen.find(
        man => !matchedMenIds.has(man.manId)
      );

      if (bestAvailableMan) {
        matches.push({
          womanEmail: womanScore.womanEmail,
          womanName: womanScore.womanName,
          manEmail: bestAvailableMan.manEmail,
          manName: bestAvailableMan.manName,
          compatibilityScore: bestAvailableMan.score
        });
        matchedMenIds.add(bestAvailableMan.manId);
      } else {
        // No compatible men available for this woman
        const reason = womanScore.compatibleMen.length === 0
          ? "No men pass dealbreakers"
          : "All compatible men already matched";

        const unmatchedWoman: {
          email: string;
          name: string;
          reason: string;
          incompatibleMen?: Array<{
            manEmail: string;
            manName: string;
            reasons: string[];
          }>;
        } = {
          email: womanScore.womanEmail,
          name: womanScore.womanName,
          reason
        };

        // Include hard dealbreaker details if this woman has no compatible men
        // (Only gender and language are hard dealbreakers now)
        if (womanScore.compatibleMen.length === 0 && womanScore.incompatibleMen.length > 0) {
          unmatchedWoman.incompatibleMen = womanScore.incompatibleMen;
        }

        unmatchedWomen.push(unmatchedWoman);
      }
    }

    // Calculate stats about unmatched men
    const unmatchedMen = menProfiles
      .filter(man => !matchedMenIds.has(man.id))
      .map(man => {
        // Count how many women this man was compatible with
        const compatibleWithCount = womenScores.filter(ws =>
          ws.compatibleMen.some(cm => cm.manId === man.id)
        ).length;

        return {
          email: man.email,
          name: `${man.first_name} ${man.last_name || ''}`.trim(),
          compatibleWithCount,
          reason: compatibleWithCount === 0
            ? "Failed dealbreakers with all women"
            : "Not selected (another man was better match)"
        };
      });

    const avgMatchScore = matches.length > 0
      ? matches.reduce((sum, m) => sum + m.compatibilityScore, 0) / matches.length
      : 0;

    return new Response(JSON.stringify({
      success: true,
      matches,
      unmatchedWomen,
      unmatchedMen,
      stats: {
        totalMenEvaluated: menProfiles.length,
        totalWomen: womenProfiles.length,
        successfulMatches: matches.length,
        unmatchedWomenCount: unmatchedWomen.length,
        unmatchedMenCount: unmatchedMen.length,
        averageMatchScore: Math.round(avgMatchScore * 10) / 10
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("Error in event-matcher function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
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

// Check if two users pass hard dealbreaker criteria (only gender and language)
function passesHardDealbreakers(
  user1Answers: Record<number, string>,
  user2Answers: Record<number, string>,
): true | { passes: false; reasons: string[] } {
  const failureReasons: string[] = [];

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
    failureReasons.push("Gender preference mismatch");
  }
  if (user2Pref && !user2OpenTo.includes(user2Pref)) {
    failureReasons.push("Gender preference mismatch");
  }

  // Question 25: Languages - must have at least one in common
  const user1Languages = user1Answers[25]?.split(",") || [];
  const user2Languages = user2Answers[25]?.split(",") || [];
  const hasCommonLanguage = user1Languages.some((lang) => user2Languages.includes(lang));
  if (!hasCommonLanguage) {
    failureReasons.push("No common language");
  }

  if (failureReasons.length > 0) {
    return { passes: false, reasons: failureReasons };
  }
  return true;
}

// Calculate penalties for soft dealbreakers (applied as score deductions)
function calculateDealbreakerPenalty(
  user1Answers: Record<number, string>,
  user2Answers: Record<number, string>,
  user1Age: number,
  user2Age: number,
): number {
  let penalty = 0;

  // Question 18: Relationship type must match exactly (20% penalty if different)
  if (user1Answers[18] !== user2Answers[18]) {
    penalty += 20;
  }

  // Question 20: Age range preferences (15% penalty if outside range)
  const user1AgeRange = user1Answers[20]?.split(":").map(Number) || [18, 99];
  const user2AgeRange = user2Answers[20]?.split(":").map(Number) || [18, 99];
  if (user2Age < user1AgeRange[0] || user2Age > user1AgeRange[1]) {
    penalty += 15;
  }
  if (user1Age < user2AgeRange[0] || user1Age > user2AgeRange[1]) {
    penalty += 15;
  }

  // Question 21 & 22: Smoking/Drinking/Drugs dealbreakers (10% penalty per habit conflict)
  const user1Does = user1Answers[21]?.split(",") || [];
  const user2Does = user2Answers[21]?.split(",") || [];
  const user1Dealbreakers = user1Answers[22]?.split(",") || [];
  const user2Dealbreakers = user2Answers[22]?.split(",") || [];

  // Check if user1 does something that is a dealbreaker for user2
  for (const habit of user1Does) {
    if (user2Dealbreakers.includes(habit)) {
      penalty += 10;
    }
  }
  // Check if user2 does something that is a dealbreaker for user1
  for (const habit of user2Does) {
    if (user1Dealbreakers.includes(habit)) {
      penalty += 10;
    }
  }

  // Question 26 & 27: Cultural background preference (12% penalty if required but different)
  if (user1Answers[26] === "A") {
    const user1Culture = user1Answers[27]?.split(",") || [];
    const user2Culture = user2Answers[27]?.split(",") || [];
    const hasCommonCulture = user1Culture.some((c) => user2Culture.includes(c));
    if (!hasCommonCulture) {
      penalty += 12;
    }
  }
  if (user2Answers[26] === "A") {
    const user1Culture = user1Answers[27]?.split(",") || [];
    const user2Culture = user2Answers[27]?.split(",") || [];
    const hasCommonCulture = user1Culture.some((c) => user2Culture.includes(c));
    if (!hasCommonCulture) {
      penalty += 12;
    }
  }

  // Question 29: Religion importance (15% penalty if required but different)
  if (user1Answers[29] === "A") {
    if (user1Answers[28] !== user2Answers[28]) {
      penalty += 15;
    }
  }
  if (user2Answers[29] === "A") {
    if (user1Answers[28] !== user2Answers[28]) {
      penalty += 15;
    }
  }

  // Question 31: Political views preference (12% penalty if required but different)
  if (user1Answers[31] === "A") {
    if (user1Answers[30] !== user2Answers[30]) {
      penalty += 12;
    }
  }
  if (user2Answers[31] === "A") {
    if (user1Answers[30] !== user2Answers[30]) {
      penalty += 12;
    }
  }

  // Question 33: Shared interests requirement (10% penalty if required but none shared)
  if (user1Answers[33] === "A" || user2Answers[33] === "A") {
    const user1Interests = user1Answers[32]?.split(",") || [];
    const user2Interests = user2Answers[32]?.split(",") || [];
    const hasSharedInterest = user1Interests.some((i) => user2Interests.includes(i));
    if (!hasSharedInterest) {
      penalty += 10;
    }
  }

  return penalty;
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
    if ([32, 34, 35, 36].includes(qNum)) {
      const set1 = ans1.split(",");
      const set2 = ans2.split(",");
      const overlap = set1.filter((v) => set2.includes(v)).length;
      const total = new Set([...set1, ...set2]).size;
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
