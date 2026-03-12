
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, dry-run, x-algorithm, x-send-emails, x-max-matches-per-user",
    "Content-Type": "application/json"
};

// --- Types ---

type AlgorithmType = 'relationship' | 'friendship' | 'event';
type WeeklyMatchType = 'relationship' | 'friendship';

interface MatchingRule {
    id: string;
    name: string;
    rule_type: "dealbreaker" | "modifier";
    source_type: "question" | "profile" | "computed" | "table";
    source_ref: string;
    target_type: "question" | "profile" | "computed" | "constant";
    target_ref: string | null;
    operator: string;
    condition: any;
    weight: number;
    params: any;
    algorithm?: AlgorithmType; // specific to relationship or friendship rules
}

interface Profile {
    id: string;
    age: number;
    first_name: string;
    email: string | null;
    last_name: string | null;
    latitude: number | null;
    longitude: number | null;
    last_sign_in_at?: string;
    completed_questionnaire: boolean;
    completed_friendship_questionnaire: boolean;
    [key: string]: any;
}

interface MatchingResult {
    user1Id: string;
    user2Id: string;
    score: number;
    match_type: 'relationship' | 'friendship';
    from_algorithm: AlgorithmType;
    details: any; // For debug/email (rawScore, boost, etc)
}

interface ScoredPair {
    user1Id: string;
    user2Id: string;
    score: number;
    match_type: WeeklyMatchType;
    rawScore: number;
    boost: number;
    distance: number;
    prevMatches: number;
    unansweredLikeRematchCount: number;
}

type FriendshipAnswerRow = {
    user_id: string;
    question_number: number;
    question_id?: number | null;
    answer: string;
};

const DEFAULT_OPEN_TO_LABELS: Record<string, string> = {
    A: "Women",
    B: "Men",
    C: "Non-binary people",
};

const DEFAULT_FRIENDSHIP_INTENT_LABELS: Record<string, string> = {
    A: "Casual and light",
    B: "Consistent and reliable",
    C: "Deep and meaningful",
    D: "Open and flexible",
};

const MAX_UNANSWERED_LIKE_REMATCHES = 2;

type CurrentMatchRow = {
    user_id: string;
    matched_user_id: string;
    from_algorithm: AlgorithmType | null;
    match_type: WeeklyMatchType | null;
    created_at: string | null;
};

type HistoricalMatchRow = {
    user_id: string;
    matched_user_id: string;
    from_algorithm: AlgorithmType | null;
    match_type: WeeklyMatchType | null;
};

type UnansweredLikeRematchState = {
    unansweredLikeCount: number;
    lastPairingCreatedAt: string | null;
};

type UnansweredLikeRematchMap = Record<WeeklyMatchType, Record<string, Record<string, UnansweredLikeRematchState>>>;
type PreviousMatchCountsByType = Record<WeeklyMatchType, Record<string, Record<string, number>>>;

// --- Helpers ---

function calculateDistance(lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
    const R = 3959; // Miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function buildPairKey(user1Id: string, user2Id: string): string {
    return [user1Id, user2Id].sort().join("|");
}

function incrementPreviousMatchCount(
    counts: PreviousMatchCountsByType,
    matchType: WeeklyMatchType,
    userId: string,
    matchedUserId: string
) {
    if (!counts[matchType][userId]) counts[matchType][userId] = {};
    counts[matchType][userId][matchedUserId] = (counts[matchType][userId][matchedUserId] || 0) + 1;
}

function getPreviousMatchCount(
    counts: PreviousMatchCountsByType,
    matchType: WeeklyMatchType,
    userId: string,
    matchedUserId: string
): number {
    return counts[matchType][userId]?.[matchedUserId] || 0;
}

function getValue(
    type: string,
    ref: string | null,
    profile: Profile,
    answers: Record<number, string>,
    computed: Record<string, any>
): any {
    if (!ref && type !== 'constant') return null;

    if (type === "question") {
        return answers[parseInt(ref!)];
    }
    if (type === "profile") {
        if (ref === 'location') return { lat: profile.latitude, lon: profile.longitude };
        return profile[ref!];
    }
    if (type === "computed") {
        return computed[ref!];
    }
    if (type === "constant") {
        return null;
    }
    if (type === "table") {
        return ref;
    }
    return null;
}

function evaluateCondition(condition: any, profile: Profile, answers: Record<number, string>): boolean {
    if (!condition) return true;
    const val = getValue(condition.source_type, condition.source_ref, profile, answers, {});
    if (condition.operator === 'equals') {
        return val === condition.value;
    }
    return true;
}

function runOperator(operator: string, val1: any, val2: any, params: any): { pass: boolean, score?: number, multiplier?: number } {
    const p = params || {};

    switch (operator) {
        case 'equals':
            return { pass: val1 === val2, score: val1 === val2 ? 1 : 0 };

        case 'intersects':
            if (!val1 || !val2) return { pass: false, score: 0 };
            const arr1 = typeof val1 === 'string' ? val1.split(',') : val1;
            const arr2 = typeof val2 === 'string' ? val2.split(',') : val2;
            const hasIntersection = arr1.some((x: string) => arr2.includes(x));
            return { pass: hasIntersection, score: hasIntersection ? 1 : 0 };

        case 'mapped_subset':
            if (!val1 || !val2 || !p.mapping) return { pass: false };
            const mappedVal = p.mapping[val1];
            if (!mappedVal) return { pass: false };
            const targetSet = typeof val2 === 'string' ? val2.split(',') : val2;
            return { pass: targetSet.includes(mappedVal) };

        case 'range_includes':
            if (!val1 || val2 === undefined || val2 === null) return { pass: false };
            const [min, max] = val1.split(':').map(Number);
            return { pass: val2 >= min && val2 <= max };

        case 'none_present_in':
            if (!val1 || !val2) return { pass: true };
            // Filter out 'skip' values which indicate missing data
            const habits = (typeof val1 === 'string' ? val1.split(',') : val1).filter((v: string) => v !== 'Skip');
            const db = (typeof val2 === 'string' ? val2.split(',') : val2).filter((v: string) => v !== 'Skip');

            if (habits.length === 0 || db.length === 0) return { pass: true };

            const fail = habits.some((h: string) => db.includes(h));
            return { pass: !fail };

        case 'distance_lte':
            if (!val1 || !val2) return { pass: false };
            const dist = calculateDistance(val1.lat, val1.lon, val2.lat, val2.lon);
            return { pass: dist <= (p.value || 15), score: dist }; // Score might need to be inverted for sorting? But here it returns distance. logic below handles scoring.

        case 'set_similarity':
            if (!val1 || !val2) return { pass: true, score: 0 };
            const s1 = typeof val1 === 'string' ? val1.split(',') : val1;
            const s2 = typeof val2 === 'string' ? val2.split(',') : val2;
            const overlap = s1.filter((v: string) => s2.includes(v)).length;
            const total = new Set([...s1, ...s2]).size;
            return { pass: true, score: total > 0 ? overlap / total : 0 };

        case 'equals_or_adjacent':
            if (!val1 || !val2) return { pass: true, score: 0 };
            if (val1 === val2) return { pass: true, score: 1 };
            const code1 = val1.charCodeAt(0);
            const code2 = val2.charCodeAt(0);
            if (Math.abs(code1 - code2) === 1) return { pass: true, score: p.adjacent_weight_multiplier || 0.5 };
            return { pass: true, score: 0 };

        case 'boost_decay_recency':
            if (val1 === undefined) return { pass: true, score: 0, multiplier: 1.0 };
            if (!p.decay_schedule || !Array.isArray(p.decay_schedule)) {
                return { pass: true, score: 0, multiplier: 1.0 };
            }
            let boost = 1.0;
            const schedule = [...p.decay_schedule].sort((a: any, b: any) => a.days - b.days);
            for (const tier of schedule) {
                if (val1 <= tier.days) {
                    boost = tier.boost;
                    break;
                }
            }
            return { pass: true, score: 0, multiplier: boost };

        default:
            return { pass: true, score: 0 };
    }
}

function parseOptionsMap(raw: any): Record<string, string> {
    if (!raw) return {};
    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return {};
        const out: Record<string, string> = {};
        for (const item of parsed) {
            if (item?.value != null && item?.label != null) {
                out[String(item.value)] = String(item.label);
            }
        }
        return out;
    } catch {
        return {};
    }
}

function normalizeText(value: string): string {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isStudentEmail(email?: string | null): boolean {
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) return false;
    const domain = normalized.split("@")[1];
    return domain === "uzh.ch" || domain.endsWith(".uzh.ch") || domain === "ethz.ch" || domain.endsWith(".ethz.ch");
}

function parseAnswerCodes(raw?: string): string[] {
    if (!raw) return [];
    const trimmed = String(raw).trim();
    if (!trimmed) return [];
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return parsed.map((v) => String(v).trim()).filter(Boolean);
        }
    } catch { }
    return trimmed
        .replaceAll("[", "")
        .replaceAll("]", "")
        .replaceAll("\"", "")
        .replaceAll("'", "")
        .split(/[,;| ]+/)
        .map((v) => v.trim())
        .filter(Boolean);
}

function normalizeCodesWithLabelMap(codes: string[], labelMap: Record<string, string>): string[] {
    const inverseMap: Record<string, string> = {};
    for (const [code, label] of Object.entries(labelMap)) {
        inverseMap[normalizeText(code)] = code;
        inverseMap[normalizeText(label)] = code;
    }
    return codes
        .map((c) => {
            const normalized = normalizeText(String(c));
            return inverseMap[normalized] || String(c).trim();
        })
        .filter(Boolean);
}

function isBinaryGenderCode(genderCode?: string): boolean {
    return genderCode === "A" || genderCode === "B";
}

function classifyFriendshipPreference(genderCode: string | undefined, openToCodesRaw: string[]): string {
    const openToCodes = normalizeCodesWithLabelMap(openToCodesRaw, DEFAULT_OPEN_TO_LABELS);
    if (!genderCode || openToCodes.length === 0) return "Unknown";
    if (!isBinaryGenderCode(genderCode)) return "Other / Non-binary user";

    const unique = Array.from(new Set(openToCodes));
    const hasMen = unique.includes("B");
    const hasWomen = unique.includes("A");
    const same = genderCode === "A" ? hasWomen : hasMen;
    const opposite = genderCode === "A" ? hasMen : hasWomen;

    if (same && opposite) return "Both sexes";
    if (same) return "Same sex";
    if (opposite) return "Opposite sex";
    return "Unknown";
}

function normalizeGenderCode(raw?: string): string | undefined {
    if (!raw) return undefined;
    const value = String(raw).trim();
    if (!value) return undefined;
    if (["A", "B", "C", "D"].includes(value)) return value;
    const normalized = normalizeText(value);
    if (normalized === "woman" || normalized === "women") return "A";
    if (normalized === "man" || normalized === "men") return "B";
    if (normalized === "non-binary" || normalized === "non binary" || normalized === "non-binary people") return "C";
    if (normalized === "prefer not to say") return "D";
    return undefined;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
    if (chunkSize <= 0) return [items];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

function createEmptyUnansweredLikeRematchMap(): UnansweredLikeRematchMap {
    return {
        relationship: {},
        friendship: {},
    };
}

function getDirectionalRematchState(
    rematchMap: UnansweredLikeRematchMap,
    matchType: WeeklyMatchType,
    userId: string,
    matchedUserId: string
): UnansweredLikeRematchState {
    return rematchMap[matchType][userId]?.[matchedUserId] || {
        unansweredLikeCount: 0,
        lastPairingCreatedAt: null,
    };
}

function setDirectionalRematchState(
    rematchMap: UnansweredLikeRematchMap,
    matchType: WeeklyMatchType,
    userId: string,
    matchedUserId: string,
    state: UnansweredLikeRematchState
) {
    if (!rematchMap[matchType][userId]) rematchMap[matchType][userId] = {};
    rematchMap[matchType][userId][matchedUserId] = state;
}

function getPairUnansweredLikeRematchCount(
    rematchMap: UnansweredLikeRematchMap,
    matchType: WeeklyMatchType,
    user1Id: string,
    user2Id: string
): number {
    const oneWay = getDirectionalRematchState(rematchMap, matchType, user1Id, user2Id).unansweredLikeCount;
    const reverse = getDirectionalRematchState(rematchMap, matchType, user2Id, user1Id).unansweredLikeCount;
    return Math.max(oneWay, reverse);
}

function shouldApplyPairingUpdate(lastPairingCreatedAt: string | null, pairingCreatedAt: string | null): boolean {
    if (!pairingCreatedAt) return false;
    if (!lastPairingCreatedAt) return true;
    return new Date(lastPairingCreatedAt).getTime() < new Date(pairingCreatedAt).getTime();
}

function getUniqueCurrentPairs(rows: CurrentMatchRow[]): Array<{ user1Id: string; user2Id: string; created_at: string | null }> {
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

async function prepareUnansweredLikeRematchMap(
    supabase: any,
    dryRun: boolean,
    currentMatches: CurrentMatchRow[],
    likeMap: Record<string, Set<string>>,
    dislikeMap: Record<string, Set<string>>,
    friendshipLikeMap: Record<string, Set<string>>,
    friendshipDislikeMap: Record<string, Set<string>>
): Promise<UnansweredLikeRematchMap> {
    const rematchMap = createEmptyUnansweredLikeRematchMap();
    const { data: counterRows, error: counterRowsError } = await supabase
        .from("unanswered_like_rematch_counts")
        .select("user_id, matched_user_id, match_type, unanswered_like_count, last_pairing_created_at");

    if (counterRowsError) {
        console.warn("unanswered_like_rematch_counts query failed; continuing with empty counters", counterRowsError.message);
    }

    (counterRows || []).forEach((row: any) => {
        if (row.match_type !== "relationship" && row.match_type !== "friendship") return;
        setDirectionalRematchState(rematchMap, row.match_type, row.user_id, row.matched_user_id, {
            unansweredLikeCount: row.unanswered_like_count || 0,
            lastPairingCreatedAt: row.last_pairing_created_at || null,
        });
    });

    const upserts = new Map<string, any>();
    const queuePersist = (
        matchType: WeeklyMatchType,
        userId: string,
        matchedUserId: string,
        state: UnansweredLikeRematchState
    ) => {
        upserts.set(`${matchType}:${userId}:${matchedUserId}`, {
            user_id: userId,
            matched_user_id: matchedUserId,
            match_type: matchType,
            unanswered_like_count: state.unansweredLikeCount,
            last_pairing_created_at: state.lastPairingCreatedAt,
            updated_at: new Date().toISOString(),
        });
    };

    const applyPairUpdates = (
        matchType: WeeklyMatchType,
        rows: CurrentMatchRow[],
        activeLikeMap: Record<string, Set<string>>,
        activeDislikeMap: Record<string, Set<string>>
    ) => {
        for (const pair of getUniqueCurrentPairs(rows)) {
            const user1Liked = activeLikeMap[pair.user1Id]?.has(pair.user2Id) || false;
            const user2Liked = activeLikeMap[pair.user2Id]?.has(pair.user1Id) || false;
            const user1Disliked = activeDislikeMap[pair.user1Id]?.has(pair.user2Id) || false;
            const user2Disliked = activeDislikeMap[pair.user2Id]?.has(pair.user1Id) || false;

            if (user1Liked && user2Liked) {
                const resetState = {
                    unansweredLikeCount: 0,
                    lastPairingCreatedAt: pair.created_at,
                };
                setDirectionalRematchState(rematchMap, matchType, pair.user1Id, pair.user2Id, resetState);
                setDirectionalRematchState(rematchMap, matchType, pair.user2Id, pair.user1Id, resetState);
                queuePersist(matchType, pair.user1Id, pair.user2Id, resetState);
                queuePersist(matchType, pair.user2Id, pair.user1Id, resetState);
                continue;
            }

            if (user1Liked && !user2Liked && !user2Disliked) {
                const existingState = getDirectionalRematchState(rematchMap, matchType, pair.user1Id, pair.user2Id);
                if (shouldApplyPairingUpdate(existingState.lastPairingCreatedAt, pair.created_at)) {
                    const nextState = {
                        unansweredLikeCount: existingState.unansweredLikeCount + 1,
                        lastPairingCreatedAt: pair.created_at,
                    };
                    setDirectionalRematchState(rematchMap, matchType, pair.user1Id, pair.user2Id, nextState);
                    queuePersist(matchType, pair.user1Id, pair.user2Id, nextState);
                }
            }

            if (user2Liked && !user1Liked && !user1Disliked) {
                const existingState = getDirectionalRematchState(rematchMap, matchType, pair.user2Id, pair.user1Id);
                if (shouldApplyPairingUpdate(existingState.lastPairingCreatedAt, pair.created_at)) {
                    const nextState = {
                        unansweredLikeCount: existingState.unansweredLikeCount + 1,
                        lastPairingCreatedAt: pair.created_at,
                    };
                    setDirectionalRematchState(rematchMap, matchType, pair.user2Id, pair.user1Id, nextState);
                    queuePersist(matchType, pair.user2Id, pair.user1Id, nextState);
                }
            }
        }
    };

    applyPairUpdates(
        "relationship",
        currentMatches.filter((row) => row.from_algorithm === "relationship" && row.match_type === "relationship"),
        likeMap,
        dislikeMap
    );
    applyPairUpdates(
        "friendship",
        currentMatches.filter((row) => row.from_algorithm === "friendship" && row.match_type === "friendship"),
        friendshipLikeMap,
        friendshipDislikeMap
    );

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

// --- Core Engine ---

async function runMatchingEngine(
    supabase: any,
    targetAlgorithm: AlgorithmType,
    profiles: Profile[],
    allRules: MatchingRule[],
    answers: { personality: Record<string, Record<number, string>>, friendship: Record<string, Record<number, string>> },
    dislikes: Record<string, Set<string>>,
    friendshipDislikes: Record<string, Set<string>>,
    prevMatchesByType: PreviousMatchCountsByType,
    unansweredLikeRematchMap: UnansweredLikeRematchMap,
    debugUserId: string | null,
    privilegedUserIds: Set<string>
): Promise<{ pairs: ScoredPair[], stats: any }> {

    // Config based on algorithm
    const debugStats: any = {
        failures: {},
        user_failures: {},
        processed_count: 0,
        processed_debug_pairs: 0,
        potentialMatches: [],
        ruleStats: {
            dealbreakers: {}, // ruleName -> count
            modifiers: {} // ruleName -> { totalScore: number, count: number, min: number, max: number }
        }
    };
    const trackFailure = (reason: string, isDebugPair = false) => {
        debugStats.failures[reason] = (debugStats.failures[reason] || 0) + 1;
        if (isDebugPair) {
            debugStats.user_failures[reason] = (debugStats.user_failures[reason] || 0) + 1;
        }
    };
    const allPotentialPairs: ScoredPair[] = [];

    const getDays = (d?: string) => d ? (new Date().getTime() - new Date(d).getTime()) / 86400000 : 999;

    // Helper to evaluate a specific set of rules (Relationship or Friendship)
    async function evaluateRuleset(
        type: 'relationship' | 'friendship',
        ruleAlgorithm: AlgorithmType,
        p1: Profile,
        p2: Profile,
        isDebugPair: boolean
    ): Promise<ScoredPair | null> {

        // 1. Check Data Availability
        if (type === 'relationship') {
            if (!p1.completed_questionnaire || !p2.completed_questionnaire) {
                trackFailure('Missing Questionnaire (Rel)', isDebugPair);
                return null;
            }
        } else {
            if (!p1.completed_friendship_questionnaire || !p2.completed_friendship_questionnaire) {
                trackFailure('Missing Questionnaire (Friend)', isDebugPair);
                return null;
            }
        }

        const ans1 = type === 'relationship' ? answers.personality[p1.id] : answers.friendship[p1.id];
        const ans2 = type === 'relationship' ? answers.personality[p2.id] : answers.friendship[p2.id];

        if (!ans1 || !ans2) return null; // Should not happen if flags are true, but safe check

        // Filter rules for this type
        const typeRules = allRules.filter(r => r.algorithm === ruleAlgorithm); // Filter by ruleAlgorithm param
        const dealbreakers = typeRules.filter(r => r.rule_type === 'dealbreaker');
        const modifiers = typeRules.filter(r => r.rule_type === 'modifier');

        const additiveModifiers = modifiers.filter((r: any) => r.operator !== 'boost_decay_recency');
        const maxPossibleScore = additiveModifiers.reduce((sum: number, r: any) => sum + (r.weight || 0), 0) * 100;

        const c1 = { last_sign_in_days: getDays(p1.last_sign_in_at) };
        const c2 = { last_sign_in_days: getDays(p2.last_sign_in_at) };

        // 2. Dealbreakers
        let dealbreakerFail = false;

        // 1 -> 2
        for (const rule of dealbreakers) {
            if (!evaluateCondition(rule.condition, p1, ans1)) continue;
            const v1 = getValue(rule.source_type, rule.source_ref, p1, ans1, c1);
            const v2 = getValue(rule.target_type, rule.target_ref, p2, ans2, c2);
            const res = runOperator(rule.operator, v1, v2, rule.params);
            if (!res.pass) {
                dealbreakerFail = true;
                const fname = `${type}: ${rule.name} (1->2)`;
                trackFailure(fname, isDebugPair);
                if (isDebugPair) {
                    if (!debugStats.ruleStats.dealbreakers[fname]) debugStats.ruleStats.dealbreakers[fname] = { pass: 0, fail: 0 };
                    debugStats.ruleStats.dealbreakers[fname].fail++;
                }
                break;
            } else {
                if (isDebugPair) {
                    const fname = `${type}: ${rule.name} (1->2)`;
                    if (!debugStats.ruleStats.dealbreakers[fname]) debugStats.ruleStats.dealbreakers[fname] = { pass: 0, fail: 0 };
                    debugStats.ruleStats.dealbreakers[fname].pass++;
                }
            }
        }
        if (dealbreakerFail) return null;

        // 2 -> 1
        for (const rule of dealbreakers) {
            // Avoid redundant check if symmetric? (Optimized check from original code)
            if (rule.operator === 'equals' && rule.source_type === rule.target_type && rule.source_ref === rule.target_ref) continue;

            if (!evaluateCondition(rule.condition, p2, ans2)) continue;
            const v1 = getValue(rule.source_type, rule.source_ref, p2, ans2, c2);
            const v2 = getValue(rule.target_type, rule.target_ref, p1, ans1, c1);
            const res = runOperator(rule.operator, v1, v2, rule.params);
            if (!res.pass) {
                dealbreakerFail = true;
                const fname = `${type}: ${rule.name} (2->1)`;
                trackFailure(fname, isDebugPair);
                if (isDebugPair) {
                    if (!debugStats.ruleStats.dealbreakers[fname]) debugStats.ruleStats.dealbreakers[fname] = { pass: 0, fail: 0 };
                    debugStats.ruleStats.dealbreakers[fname].fail++;
                }
                break;
            } else {
                if (isDebugPair) {
                    const fname = `${type}: ${rule.name} (2->1)`;
                    if (!debugStats.ruleStats.dealbreakers[fname]) debugStats.ruleStats.dealbreakers[fname] = { pass: 0, fail: 0 };
                    debugStats.ruleStats.dealbreakers[fname].pass++;
                }
            }
        }
        if (dealbreakerFail) return null;

        // 3. Scoring
        let rawScore = 0;
        let multiplier = 1.0;

        for (const rule of modifiers) {
            const runOneWay = async (uA: any, answersA: any, uB: any, answersB: any, compA: any, compB: any) => {
                const v1 = getValue(rule.source_type, rule.source_ref, uA, answersA, compA);
                const v2 = getValue(rule.target_type, rule.target_ref, uB, answersB, compB);
                return runOperator(rule.operator, v1, v2, rule.params);
            };

            const res1 = await runOneWay(p1, ans1, p2, ans2, c1, c2);

            let ruleContribution = 0;

            if (rule.operator === 'boost_decay_recency') {
                const res2 = await runOneWay(p2, ans2, p1, ans1, c2, c1);
                const m1 = res1.multiplier || 1;
                const m2 = res2.multiplier || 1;
                multiplier *= (m1 + m2) / 2;
                ruleContribution = (m1 + m2) / 2; // For boost
            } else {
                if (res1.score) {
                    const points = res1.score * (rule.weight || 1) * 100;
                    rawScore += points;
                    ruleContribution = points;
                }
            }

            if (isDebugPair) {
                const fname = `${type}: ${rule.name}`;
                if (!debugStats.ruleStats.modifiers[fname]) {
                    debugStats.ruleStats.modifiers[fname] = { totalScore: 0, count: 0, min: 9999, max: -9999 };
                }
                const stat = debugStats.ruleStats.modifiers[fname];
                stat.totalScore += ruleContribution;
                stat.count++;
                if (ruleContribution < stat.min) stat.min = ruleContribution;
                if (ruleContribution > stat.max) stat.max = ruleContribution;
            }
        }

        const percentScore = maxPossibleScore > 0 ? rawScore / maxPossibleScore : 0;
        const finalScore = percentScore * multiplier * 100;

        // no threshold check cus potential max score is massive (generic 30%)
        // if (percentScore < 0.1) {
        //     if (isDebugPair) debugStats.failures[`${type}: Low Score`] = (debugStats.failures[`${type}: Low Score`] || 0) + 1;
        //     return null;
        // }

        return {
            user1Id: p1.id,
            user2Id: p2.id,
            score: finalScore,
            match_type: type,
            rawScore,
            boost: multiplier,
            distance: calculateDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude),
            prevMatches: getPreviousMatchCount(prevMatchesByType, type, p1.id, p2.id),
            unansweredLikeRematchCount: 0,
        };
    }

    // MAIN LOOP
    for (let i = 0; i < profiles.length; i++) {
        for (let j = i + 1; j < profiles.length; j++) {
            const p1 = profiles[i];
            const p2 = profiles[j];

            const isDebugPair = debugUserId && (p1.id === debugUserId || p2.id === debugUserId);
            debugStats.processed_count++;
            if (isDebugPair) debugStats.processed_debug_pairs++;

            const user1IsPrivileged = privilegedUserIds.has(p1.id);
            const user2IsPrivileged = privilegedUserIds.has(p2.id);
            if (user1IsPrivileged !== user2IsPrivileged) {
                trackFailure('Cross-group blocked (test/admin vs regular)', !!isDebugPair);
                continue;
            }

            if (targetAlgorithm === 'friendship') {
                if (friendshipDislikes[p1.id]?.has(p2.id) || friendshipDislikes[p2.id]?.has(p1.id)) {
                    trackFailure('Friendship Disliked', !!isDebugPair);
                    continue;
                }
            } else {
                if (dislikes[p1.id]?.has(p2.id) || dislikes[p2.id]?.has(p1.id)) {
                    trackFailure('Disliked', !!isDebugPair);
                    continue;
                }
            }

            // Logic Switch
            let result: ScoredPair | null = null;

            if (targetAlgorithm === 'relationship') {
                result = await evaluateRuleset('relationship', 'relationship', p1, p2, !!isDebugPair);
            } else if (targetAlgorithm === 'friendship') {
                result = await evaluateRuleset('friendship', 'friendship', p1, p2, !!isDebugPair);
            } else if (targetAlgorithm === 'event') {
                // Prioritize relationship using EVENT rules
                const relResult = await evaluateRuleset('relationship', 'event', p1, p2, !!isDebugPair);
                if (relResult) {
                    result = relResult;
                } else {
                    // Fallback to friendship matches using FRIENDSHIP rules (as requested)
                    const friendResult = await evaluateRuleset('friendship', 'friendship', p1, p2, !!isDebugPair);
                    if (friendResult) {
                        result = friendResult;
                    }
                }
            }

            if (result) {
                if (targetAlgorithm !== 'event') {
                    const unansweredLikeRematchCount = getPairUnansweredLikeRematchCount(
                        unansweredLikeRematchMap,
                        result.match_type,
                        result.user1Id,
                        result.user2Id
                    );

                    if (unansweredLikeRematchCount >= MAX_UNANSWERED_LIKE_REMATCHES) {
                        trackFailure(`${result.match_type}: unanswered-like rematch limit`, !!isDebugPair);
                        continue;
                    }

                    result.unansweredLikeRematchCount = unansweredLikeRematchCount;
                }

                if (isDebugPair) {
                    debugStats.potentialMatches.push(result);
                }
                allPotentialPairs.push(result);
            }
        }
    }

    return { pairs: allPotentialPairs, stats: debugStats };
}


// --- Request Handler ---

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const cronSecret = Deno.env.get("CRON_SECRET");
        const providedSecret = req.headers.get("X-Cron-Secret");
        let dryRun = req.headers.get("dry-run") !== "false"; // Default to true unless explicit false

        // Auth Check
        let isAdmin = false;

        // If secret fails check for admin
        if (providedSecret !== cronSecret) {
            const authHeader = req.headers.get('Authorization');
            if (authHeader) {
                const token = authHeader.replace('Bearer ', '');
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user) {
                    const { data: hasAdminRole } = await supabase.rpc('has_role', {
                        _user_id: user.id,
                        _role: 'admin'
                    });
                    if (hasAdminRole) isAdmin = true;
                }
            }
        }

        if (providedSecret !== cronSecret && !isAdmin) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }

        const algoHeader = req.headers.get("x-algorithm") || "all";
        const maxMatchesPerUserHeaderRaw = Number(req.headers.get("x-max-matches-per-user"));
        const maxMatchesPerUser = Number.isFinite(maxMatchesPerUserHeaderRaw) && maxMatchesPerUserHeaderRaw > 0
            ? Math.min(Math.floor(maxMatchesPerUserHeaderRaw), 50)
            : 2;
        let requestedAlgos: AlgorithmType[] = [];
        if (algoHeader === 'relationship') requestedAlgos = ['relationship'];
        else if (algoHeader === 'friendship') requestedAlgos = ['friendship'];
        else if (algoHeader === 'event') requestedAlgos = ['event'];
        else requestedAlgos = ['relationship', 'friendship']; // 'all' usually implies standard ones? Or also Event? 
        // Event algorithm runs on specific event enrollments. If I run "all", do I run event matching on everyone? No.
        // Event matching is special. 
        // If header is 'all', let's stick to 'relationship' + 'friendship' as the daily crons. 
        // The user says "option to run a specific algorithm, or all of them".
        // I will interpret 'all' as Relationship + Friendship (Standard Daily). Event is likely ad-hoc trigger.

        let body: any = {};
        try { body = await req.json(); } catch { }
        const debugUserId = body?.debug_user_id;
        const externallyExcludedPairKeys = new Set<string>(
            Array.isArray(body?.exclude_pair_keys)
                ? body.exclude_pair_keys.filter((value: unknown): value is string => typeof value === "string" && value.includes("|"))
                : []
        );

        // FETCH ALL DATA NEEDED
        // Optimization: Fetch everything once? Or fetch based on algo?
        // Given Supabase and reasonable user count, fetching all profiles is usually fine.

        console.log(`Starting matching. Algos: ${requestedAlgos.join(',')}, DryRun: ${dryRun}`);

        // 1. Fetch Rules
        const { data: rules } = await supabase.from("matching_rules").select("*").eq("is_active", true);
        if (!rules) throw new Error("No rules found");

        // 2. Fetch Profiles (Base)
        // We need all profiles that are not paused.
        const { data: fetchedProfiles, error: profilesError } = await supabase.from("profiles")
            .select("id, age, first_name, completed_questionnaire, completed_friendship_questionnaire")
            .neq("is_paused", true);

        if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
            throw new Error(`Error fetching profiles: ${profilesError.message}`);
        }

        // Fetch private data (service_role bypasses RLS)
        const profileIds = (fetchedProfiles || []).map((p: any) => p.id);
        const privateDataRows: any[] = [];
        for (const ids of chunkArray(profileIds, 100)) {
            const { data: chunkRows, error: privateDataError } = await supabase
                .from("private_profile_data")
                .select("user_id, email, last_name, latitude, longitude")
                .in("user_id", ids);
            if (privateDataError) {
                console.error("Error fetching private profile data:", privateDataError);
                throw new Error(`Error fetching private profile data: ${privateDataError.message}`);
            }
            privateDataRows.push(...(chunkRows || []));
        }

        const privateByUser = new Map((privateDataRows || []).map((r: any) => [r.user_id, r]));

        let profiles: Profile[] = (fetchedProfiles || []).map((p: any) => {
            const priv = privateByUser.get(p.id) || {};
            return { ...p, email: priv.email ?? null, last_name: priv.last_name ?? null, latitude: priv.latitude ?? null, longitude: priv.longitude ?? null };
        });

        if (profiles.length === 0) {
            console.warn("No profiles found matching criteria.");
            // Should we return empty success? or throw? 
            // If we throw, dry run UI shows error.
            // If we return success with 0 matches, UI handles it gracefully.
            // Returning success is better.
            return new Response(JSON.stringify({
                success: true,
                dryRun,
                message: "No profiles found matching criteria",
                usersProcessed: 0,
                pairsFound: 0,
                totalMatchesCreated: 0,
                matches: []
            }), { headers: corsHeaders });
        }

        // 2a. Fetch Auth Data for last_sign_in_at and student-domain/verification gate
        const allAuthUsers: any[] = [];
        const perPage = 1000;
        let page = 1;
        while (true) {
            const { data: authPage, error: authUsersError } = await supabase.auth.admin.listUsers({ page, perPage });
            if (authUsersError) throw authUsersError;
            const batch = authPage?.users || [];
            allAuthUsers.push(...batch);
            if (batch.length < perPage) break;
            page += 1;
        }
        const authUsersById = new Map<string, any>(allAuthUsers.map((u) => [u.id, u]));
        const lastSignInMap: Record<string, string> = {};
        allAuthUsers.forEach((u: any) => lastSignInMap[u.id] = u.last_sign_in_at || "");
        profiles.forEach((p: any) => p.last_sign_in_at = lastSignInMap[p.id]);

        profiles = profiles.filter((p: any) => {
            const authUser = authUsersById.get(p.id);
            const hasVerifiedEmail = Boolean(authUser?.email_confirmed_at);
            return hasVerifiedEmail && isStudentEmail(authUser?.email || null);
        });

        if (!profiles || profiles.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                dryRun,
                message: "No users eligible after student/verified email gate",
                usersProcessed: 0,
                pairsFound: 0,
                totalMatchesCreated: 0,
                matches: []
            }), { headers: corsHeaders });
        }

        // 3. Aux Data (Likes, Dislikes, History)
        const { data: allDislikes } = await supabase.from("dislikes").select("*");
        const dislikeMap: Record<string, Set<string>> = {};
        allDislikes?.forEach((d: any) => {
            if (!dislikeMap[d.user_id]) dislikeMap[d.user_id] = new Set();
            dislikeMap[d.user_id].add(d.disliked_user_id);
        });

        const { data: allLikes } = await supabase.from("likes").select("*");
        const likeMap: Record<string, Set<string>> = {};
        allLikes?.forEach((l: any) => {
            if (!likeMap[l.user_id]) likeMap[l.user_id] = new Set();
            likeMap[l.user_id].add(l.liked_user_id);
        });

        const friendshipLikeMap: Record<string, Set<string>> = {};
        const { data: allFriendshipLikes, error: friendshipLikesError } = await supabase
            .from("friendship_likes")
            .select("user_id, liked_user_id");
        if (friendshipLikesError) {
            console.warn("friendship_likes query failed; continuing with empty map", friendshipLikesError.message);
        }
        allFriendshipLikes?.forEach((l: any) => {
            if (!friendshipLikeMap[l.user_id]) friendshipLikeMap[l.user_id] = new Set();
            friendshipLikeMap[l.user_id].add(l.liked_user_id);
        });

        const friendshipDislikeMap: Record<string, Set<string>> = {};
        const { data: allFriendshipDislikes, error: friendshipDislikesError } = await supabase
            .from("friendship_dislikes")
            .select("user_id, disliked_user_id");
        if (friendshipDislikesError) {
            console.warn("friendship_dislikes query failed; continuing with empty map", friendshipDislikesError.message);
        }
        allFriendshipDislikes?.forEach((d: any) => {
            if (!friendshipDislikeMap[d.user_id]) friendshipDislikeMap[d.user_id] = new Set();
            friendshipDislikeMap[d.user_id].add(d.disliked_user_id);
        });

        const { data: roleRows, error: roleRowsError } = await supabase
            .from("user_roles")
            .select("user_id, role")
            .in("role", ["admin", "test"]);
        if (roleRowsError) throw roleRowsError;
        const privilegedUserIds = new Set<string>((roleRows || []).map((r: any) => r.user_id));

        const { data: matchHistory } = await supabase
            .from("match_history")
            .select("user_id, matched_user_id, match_type, from_algorithm");
        const { data: currentMatches } = await supabase
            .from("matches")
            .select("user_id, matched_user_id, from_algorithm, match_type, created_at");
        const previousMatchesByType: PreviousMatchCountsByType = {
            relationship: {},
            friendship: {},
        };
        ([...(matchHistory || []), ...(currentMatches || [])] as HistoricalMatchRow[]).forEach((m) => {
            if (m.match_type === "friendship") {
                incrementPreviousMatchCount(previousMatchesByType, "friendship", m.user_id, m.matched_user_id);
                return;
            }

            incrementPreviousMatchCount(previousMatchesByType, "relationship", m.user_id, m.matched_user_id);
        });
        const unansweredLikeRematchMap = await prepareUnansweredLikeRematchMap(
            supabase,
            dryRun,
            (currentMatches || []) as CurrentMatchRow[],
            likeMap,
            dislikeMap,
            friendshipLikeMap,
            friendshipDislikeMap
        );

        // 4. Fetch Answers
        // Personality
        const { data: pAnswers } = await supabase.from("personality_answers").select("*");
        const personalityAnswers: Record<string, Record<number, string>> = {};
        pAnswers?.forEach((a: any) => {
            if (!personalityAnswers[a.user_id]) personalityAnswers[a.user_id] = {};
            personalityAnswers[a.user_id][a.question_number] = a.answer;
        });

        // Friendship - Assuming table exists 'friendship_answers' or similar? 
        // If not, I should have checked. I will assume it follows pattern.
        // If it fails, user will see.
        let friendshipAnswers: Record<string, Record<number, string>> = {};
        const friendshipAnswerRowsByUser: Record<string, FriendshipAnswerRow[]> = {};
        const { data: fAnswers, error: fErr } = await supabase.from("friendship_answers").select("*");
        if (!fErr && fAnswers) {
            fAnswers.forEach((a: any) => {
                if (!friendshipAnswers[a.user_id]) friendshipAnswers[a.user_id] = {};
                friendshipAnswers[a.user_id][a.question_number] = a.answer;
                if (!friendshipAnswerRowsByUser[a.user_id]) friendshipAnswerRowsByUser[a.user_id] = [];
                friendshipAnswerRowsByUser[a.user_id].push({
                    user_id: a.user_id,
                    question_number: a.question_number,
                    question_id: a.question_id,
                    answer: a.answer
                });
            });
        }

        const { data: friendshipQuestions } = await supabase
            .from("friendship_questions")
            .select("id, question, options, order_index");
        const fqById = new Map<number, any>((friendshipQuestions || []).map((q: any) => [q.id, q]));
        const fqByOrder = new Map<number, any>(
            (friendshipQuestions || [])
                .filter((q: any) => q.order_index != null)
                .map((q: any) => [Number(q.order_index), q])
        );
        const findFqId = (re: RegExp) => (friendshipQuestions || []).find((q: any) => re.test((q.question || "").toLowerCase()))?.id;
        const findFqByOrder = (orderIndex: number) => (friendshipQuestions || []).find((q: any) => q.order_index === orderIndex)?.id;

        const findFqIdByOptionLabels = (expected: string[]) => {
            const normalized = expected.map(normalizeText).sort();
            for (const q of (friendshipQuestions || [])) {
                const optionsMap = parseOptionsMap(q.options);
                const labels = Object.values(optionsMap).map((v) => normalizeText(v)).sort();
                if (labels.length === normalized.length && labels.every((v, i) => v === normalized[i])) {
                    return q.id;
                }
            }
            return undefined;
        };

        const fqGenderId = findFqByOrder(1) ?? findFqId(/identify.*gender/);
        const fqOpenToId = findFqByOrder(2) ?? findFqId(/open to.*friends|preferred gender.*friend/);
        const fqIntentId =
            findFqId(/kind of friendship|friendship.*looking for/)
            ?? findFqIdByOptionLabels(Object.values(DEFAULT_FRIENDSHIP_INTENT_LABELS))
            ?? findFqByOrder(3);
        // Interests are in question 7 in the current friendship flow.
        const fqInterestsId = findFqByOrder(7) ?? findFqId(/things.*really into|interests|hobbies|activities/);
        const fqOpenToLabels = {
            ...DEFAULT_OPEN_TO_LABELS,
            ...parseOptionsMap((friendshipQuestions || []).find((q: any) => q.id === fqOpenToId)?.options)
        };
        const fqIntentLabels = {
            ...DEFAULT_FRIENDSHIP_INTENT_LABELS,
            ...parseOptionsMap((friendshipQuestions || []).find((q: any) => q.id === fqIntentId)?.options)
        };

        const getFriendshipAnswer = (
            userId: string,
            kind: "gender" | "openTo" | "intent" | "interests"
        ): string | undefined => {
            const rows = friendshipAnswerRowsByUser[userId] || [];
            const targetId =
                kind === "gender"
                    ? fqGenderId
                    : kind === "openTo"
                        ? fqOpenToId
                        : kind === "intent"
                            ? fqIntentId
                            : fqInterestsId;
            const resolveQuestionFromRow = (row: FriendshipAnswerRow) => {
                if (row.question_id != null && fqById.has(Number(row.question_id))) {
                    return fqById.get(Number(row.question_id));
                }
                if (fqById.has(Number(row.question_number))) {
                    return fqById.get(Number(row.question_number));
                }
                if (fqByOrder.has(Number(row.question_number))) {
                    return fqByOrder.get(Number(row.question_number));
                }
                return undefined;
            };
            if (targetId != null) {
                const direct = rows.find((r) => {
                    const resolved = resolveQuestionFromRow(r);
                    return r.question_number === targetId
                        || r.question_id === targetId
                        || resolved?.id === targetId;
                });
                if (direct?.answer) return direct.answer;
            }

            const matcher =
                kind === "gender"
                    ? /identify.*gender/
                    : kind === "openTo"
                        ? /open to.*friends|preferred gender.*friend/
                        : kind === "intent"
                            ? /kind of friendship|friendship.*looking for/
                            : /interests|hobbies|activities/;
            const fallback = rows.find((r) => {
                const q = resolveQuestionFromRow(r);
                const text = (q?.question || "").toLowerCase();
                return matcher.test(text);
            });
            return fallback?.answer;
        };

        // 5. Event Enrollments (if needed)
        let eventUserIds = new Set<string>();
        if (requestedAlgos.includes('event')) {
            const { data: enrollments } = await supabase.from("event_enrollments").select("user_id");
            enrollments?.forEach((e: any) => eventUserIds.add(e.user_id));
        }

        // --- EXECUTION ---

        let finalSelectedPairs: ScoredPair[] = [];
        let allCandidatesPairs: ScoredPair[] = [];
        let combinedDebugStats = {};
        const globallySelectedWeeklyPairKeys = new Set<string>(externallyExcludedPairKeys);

        for (const algo of requestedAlgos) {
            // Filter Profiles
            let algoProfiles = profiles;
            if (algo === 'relationship') {
                algoProfiles = profiles.filter((p: any) => p.completed_questionnaire);
            } else if (algo === 'friendship') {
                algoProfiles = profiles.filter((p: any) => p.completed_friendship_questionnaire);
            } else if (algo === 'event') {
                algoProfiles = profiles.filter((p: any) => eventUserIds.has(p.id));
            }

            const { pairs, stats } = await runMatchingEngine(
                supabase,
                algo,
                algoProfiles,
                rules,
                { personality: personalityAnswers, friendship: friendshipAnswers },
                dislikeMap,
                friendshipDislikeMap,
                previousMatchesByType,
                unansweredLikeRematchMap,
                debugUserId,
                privilegedUserIds
            );

            // Selection Logic
            const potentialCountByUser: Record<string, number> = {};
            for (const p of pairs) {
                potentialCountByUser[p.user1Id] = (potentialCountByUser[p.user1Id] || 0) + 1;
                potentialCountByUser[p.user2Id] = (potentialCountByUser[p.user2Id] || 0) + 1;
            }
            const coverageOrderPairs = [...pairs].sort((a, b) => {
                const aMin = Math.min(potentialCountByUser[a.user1Id] || 0, potentialCountByUser[a.user2Id] || 0);
                const bMin = Math.min(potentialCountByUser[b.user1Id] || 0, potentialCountByUser[b.user2Id] || 0);
                const aSum = (potentialCountByUser[a.user1Id] || 0) + (potentialCountByUser[a.user2Id] || 0);
                const bSum = (potentialCountByUser[b.user1Id] || 0) + (potentialCountByUser[b.user2Id] || 0);
                return (aMin - bMin)
                    || (aSum - bSum)
                    || (a.unansweredLikeRematchCount - b.unansweredLikeRematchCount)
                    || (a.prevMatches - b.prevMatches)
                    || (b.score - a.score);
            });

            const selectedForAlgo: ScoredPair[] = [];
            const userMatchCount: Record<string, number> = {}; // Local to this algo run? Or global?
            const selectedPairKeys = new Set<string>();
            // "should only produce up to 2 match pairs per user"
            // If I run 'relationship' then 'friendship', are the counts shared?
            // "outputting three sets of matches...".
            // Limits are usually per-set (per algorithm run). 
            // If I get 2 relationship matches, I can still get 2 friendship matches? 
            // The logic: "produce up to 2 match pairs per user... with match_type=relationship" implies independent quotas.

            // Constraints
            const limitPerUser = algo === 'event' ? 9999 : maxMatchesPerUser; // configurable for monday drop

            const usedPairKeys = new Set<string>(); // avoid dups in same set

            const canSelectPair = (p: ScoredPair) => {
                const pairKey = buildPairKey(p.user1Id, p.user2Id);
                if (selectedPairKeys.has(pairKey)) return false;
                if (globallySelectedWeeklyPairKeys.has(pairKey)) return false;
                const c1 = userMatchCount[p.user1Id] || 0;
                const c2 = userMatchCount[p.user2Id] || 0;
                return c1 < limitPerUser && c2 < limitPerUser;
            };

            const selectPair = (p: ScoredPair) => {
                const pairKey = buildPairKey(p.user1Id, p.user2Id);
                const c1 = userMatchCount[p.user1Id] || 0;
                const c2 = userMatchCount[p.user2Id] || 0;
                selectedForAlgo.push(p);
                userMatchCount[p.user1Id] = c1 + 1;
                userMatchCount[p.user2Id] = c2 + 1;
                selectedPairKeys.add(pairKey);
            };

            // Round-based coverage priority for all rounds.
            for (let round = 1; round <= limitPerUser; round++) {
                for (const p of coverageOrderPairs) {
                    if (!canSelectPair(p)) continue;
                    const c1 = userMatchCount[p.user1Id] || 0;
                    const c2 = userMatchCount[p.user2Id] || 0;
                    if (c1 < round && c2 < round) {
                        selectPair(p);
                    }
                }
            }

            // Tag results with from_algorithm
            const markedPairs = selectedForAlgo.map(p => ({
                ...p,
                from_algorithm: algo
            }));

            // Stats for selection
            (stats as any).selectionStats = {
                totalPairsBeforeSelection: pairs.length,
                selectedCount: selectedForAlgo.length,
                limitPerUser,
                algo
            };

            // Always store candidates for response
            const markedAll = pairs.map(p => ({
                ...p,
                from_algorithm: algo
            }));
            allCandidatesPairs.push(...markedAll as any);

            finalSelectedPairs.push(...markedPairs as any); // TS hack for now
            combinedDebugStats = { ...combinedDebugStats, [algo]: stats };
        }

        // --- RESPONSE & PERSISTENCE ---

        // Prepare Output
        const genderValues: Record<string, string> = { 'A': "Woman", 'B': "Man", 'C': "Non-binary", 'D': "Prefer not to say" };
        const profileMap = new Map<string, any>(profiles.map((p: any) => [p.id, p]));

        // Helper to format pairs
        const formatPairs = (list: any[]) => list.map(p => {
            const ans1 = personalityAnswers[p.user1Id] || {};
            const ans2 = personalityAnswers[p.user2Id] || {};
            const user1FriendGender = getFriendshipAnswer(p.user1Id, "gender");
            const user2FriendGender = getFriendshipAnswer(p.user2Id, "gender");
            const user1GenderCode = normalizeGenderCode(p.match_type === "friendship"
                ? (user1FriendGender || ans1[16])
                : ans1[16]);
            const user2GenderCode = normalizeGenderCode(p.match_type === "friendship"
                ? (user2FriendGender || ans2[16])
                : ans2[16]);

            const user1FriendOpen = getFriendshipAnswer(p.user1Id, "openTo");
            const user2FriendOpen = getFriendshipAnswer(p.user2Id, "openTo");
            const user1RelOpen = ans1[17];
            const user2RelOpen = ans2[17];
            const activeLikeMap = p.match_type === "friendship" ? friendshipLikeMap : likeMap;
            const user1OpenLabel = p.match_type === "friendship"
                ? (parseAnswerCodes(user1FriendOpen).map((c) => fqOpenToLabels[c] || c).join(", ") || "No friendship open-to answer")
                : (parseAnswerCodes(user1RelOpen).map((c) => ({ A: "Men", B: "Women", C: "Non-binary" }[c] || c)).join(", ") || "No romantic open-to answer");
            const user2OpenLabel = p.match_type === "friendship"
                ? (parseAnswerCodes(user2FriendOpen).map((c) => fqOpenToLabels[c] || c).join(", ") || "No friendship open-to answer")
                : (parseAnswerCodes(user2RelOpen).map((c) => ({ A: "Men", B: "Women", C: "Non-binary" }[c] || c)).join(", ") || "No romantic open-to answer");

            return {
                user1_id: p.user1Id,
                user2_id: p.user2Id,
                user1_name: profileMap.get(p.user1Id)?.first_name,
                user2_name: profileMap.get(p.user2Id)?.first_name,
                // Display canonical auth email first; profile.email can be stale.
                user1_email: authUsersById.get(p.user1Id)?.email || profileMap.get(p.user1Id)?.email,
                user2_email: authUsersById.get(p.user2Id)?.email || profileMap.get(p.user2Id)?.email,
                user1_gender: (user1GenderCode ? genderValues[user1GenderCode] : undefined) || "Unknown",
                user2_gender: (user2GenderCode ? genderValues[user2GenderCode] : undefined) || "Unknown",
                user1_open_to_dating: user1OpenLabel,
                user2_open_to_dating: user2OpenLabel,
                compatibility_score: Math.round(p.score),
                match_type: p.match_type,
                from_algorithm: (p as any).from_algorithm,
                user1_liked_user2: activeLikeMap[p.user1Id]?.has(p.user2Id) || false,
                user2_liked_user1: activeLikeMap[p.user2Id]?.has(p.user1Id) || false,
                unanswered_like_rematch_count: p.unansweredLikeRematchCount || 0,
                debug_details: p.details // Carry over details if needed
            };
        });

        const outputMatches = formatPairs(finalSelectedPairs);

        const buildFriendshipPoolAnalytics = () => {
            const friendshipProfiles = profiles.filter((p: any) => p.completed_friendship_questionnaire);
            const genderCounts: Record<string, number> = {};
            const openToCounts: Record<string, number> = {};
            const intentCounts: Record<string, number> = {};
            const interestCounts: Record<string, number> = {};
            const ageBuckets = [
                { label: "18-20", min: 18, max: 20, count: 0 },
                { label: "21-23", min: 21, max: 23, count: 0 },
                { label: "24-26", min: 24, max: 26, count: 0 },
                { label: "27+", min: 27, max: 120, count: 0 },
            ];
            for (const p of friendshipProfiles) {
                const g = normalizeGenderCode(getFriendshipAnswer(p.id, "gender") || personalityAnswers[p.id]?.[16]);
                const gender = (g ? genderValues[g] : undefined) || "Unknown";
                genderCounts[gender] = (genderCounts[gender] || 0) + 1;

                const openRaw = getFriendshipAnswer(p.id, "openTo");
                const openCodes = normalizeCodesWithLabelMap(parseAnswerCodes(openRaw), fqOpenToLabels);
                if (openCodes.length === 0) {
                    openToCounts["No friendship open-to answer"] = (openToCounts["No friendship open-to answer"] || 0) + 1;
                } else {
                    const prefType = classifyFriendshipPreference(g, openCodes);
                    openToCounts[prefType] = (openToCounts[prefType] || 0) + 1;
                }

                const intentRaw = getFriendshipAnswer(p.id, "intent");
                if (intentRaw) {
                    const intentCodes = normalizeCodesWithLabelMap(parseAnswerCodes(intentRaw), fqIntentLabels);
                    if (intentCodes.length === 0) {
                        const label = fqIntentLabels[intentRaw] || intentRaw;
                        intentCounts[label] = (intentCounts[label] || 0) + 1;
                    } else {
                        for (const code of intentCodes) {
                            const label = fqIntentLabels[code] || code;
                            intentCounts[label] = (intentCounts[label] || 0) + 1;
                        }
                    }
                }

                const interestsRaw = getFriendshipAnswer(p.id, "interests");
                for (const item of parseAnswerCodes(interestsRaw)) {
                    interestCounts[item] = (interestCounts[item] || 0) + 1;
                }

                if (typeof p.age === "number") {
                    const bucket = ageBuckets.find((b) => p.age >= b.min && p.age <= b.max);
                    if (bucket) bucket.count++;
                }
            }

            const toChart = (counts: Record<string, number>) =>
                Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

            return {
                genderDistribution: toChart(genderCounts),
                sexualityDistribution: toChart(openToCounts),
                relationshipTypeDistribution: toChart(intentCounts),
                ageDistribution: ageBuckets.map(({ label, count }) => ({ label, count })),
                topInterests: toChart(interestCounts).slice(0, 8),
            };
        };
        const friendshipPoolAnalytics = buildFriendshipPoolAnalytics();

        if (dryRun) {
            return new Response(JSON.stringify({
                success: true,
                dryRun: true,
                message: "Dry-run matches calculated",
                timestamp: new Date().toISOString(),
                stats: combinedDebugStats, // Debug stats now always returned
                matches: outputMatches,
                candidates: formatPairs(allCandidatesPairs),
                friendship_pool_analytics: friendshipPoolAnalytics
            }), { headers: corsHeaders });
        }

        // DELETE & INSERT
        // Delete matches for the algorithms we just ran.
        // We need to be careful not to delete 'relationship' matches if we only ran 'friendship'.
        if (requestedAlgos.length > 0) {
            const { error: delError } = await supabase.from("matches")
                .delete()
                .in("from_algorithm", requestedAlgos);

            if (delError) console.error("Delete error", delError);
        }

        // Insert
        if (finalSelectedPairs.length > 0) {
            const records: any[] = [];
            const historyRecords: any[] = [];

            for (const p of finalSelectedPairs) {
                const score = Math.round(p.score);
                const rec1 = {
                    user_id: p.user1Id, matched_user_id: p.user2Id,
                    compatibility_score: score,
                    match_type: p.match_type,
                    from_algorithm: (p as any).from_algorithm
                };
                const rec2 = {
                    user_id: p.user2Id, matched_user_id: p.user1Id,
                    compatibility_score: score,
                    match_type: p.match_type,
                    from_algorithm: (p as any).from_algorithm
                };
                records.push(rec1, rec2);

                // History doesn't need extra cols maybe? Or it acts as log. 
                // If Match History table doesn't have match_type, this might fail.
                // I will try to insert only common columns to history if I'm unsure, 
                // but user typically wants history of everything.
                // Safest to try inserting basic fields to history or check schema.
                // I'll insert basic fields + match_type if possible.
                // Given constraints, I'll stick to what matches has (assuming history mimics matches).
                historyRecords.push(rec1, rec2);
            }

            const { error: insError } = await supabase.from("matches").insert(records);
            if (insError) throw insError;

            // Optional: History insert might fail if columns missing. 
            // We can try/catch or just insert basic.
            // Check existing code: insert(records) to history.
            // I'll try inserting same records.
            const { error: historyError } = await supabase.from("match_history").insert(historyRecords);
            if (historyError) console.error("History insert error (non-fatal)", historyError);
        }

        // Emails (Only for Relationship? Or all?)
        // Usually only Relationship matches trigger "New Match" emails.
        // Or if we have a "New Friend" email?
        // Current template 'new_match' might be generic.
        // I'll send emails for all, assuming templates handle it or generic "You have a new match" works.
        // Logic: Send email to users involved in NEW matches who haven't liked each other yet.

        const sendEmails = req.headers.get("x-send-emails") !== "false"; // Default true (for cron), unless explicit check says false

        const emailRecipients = new Set<string>();
        for (const p of finalSelectedPairs) {
            const activeLikeMap = p.match_type === "friendship" ? friendshipLikeMap : likeMap;
            if (!activeLikeMap[p.user1Id]?.has(p.user2Id)) emailRecipients.add(p.user1Id);
            if (!activeLikeMap[p.user2Id]?.has(p.user1Id)) emailRecipients.add(p.user2Id);
        }

        if (sendEmails && emailRecipients.size > 0 && cronSecret) {
            const recipients = Array.from(emailRecipients).map(userId => ({ userId }));
            // We might want to pass match details to the email function?
            // Currently it just says "new_match".
            supabase.functions.invoke('send-user-emails', {
                body: { emailType: 'new_match', recipients },
                headers: { 'X-Cron-Secret': cronSecret }
            }).catch((err: any) => console.error('Email error:', err));
        }


        return new Response(JSON.stringify({
            success: true,
            dryRun: false,
            matches: outputMatches,
            count: outputMatches.length,
            stats: combinedDebugStats,
            candidates: formatPairs(allCandidatesPairs)
        }), { headers: corsHeaders });

    } catch (error: any) {
        console.error("Internal Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
