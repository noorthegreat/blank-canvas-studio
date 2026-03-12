import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ProfileViewDialog from "@/components/ProfileViewDialog";
import { BarChart3, RefreshCw, Trash2, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

type Match = any;

type PersonalityAnswer = {
    question_number: number;
    answer: string;
    answer_custom: string | null;
};

type ChartDatum = {
    label: string;
    count: number;
};

type OptionMap = Record<string, string>;

type MondayPreviewRow = {
    user1_name?: string;
    user1_email?: string;
    user1_gender?: string;
    user1_open_to_dating?: string;
    user2_name?: string;
    user2_email?: string;
    user2_gender?: string;
    user2_open_to_dating?: string;
    compatibility_score?: number;
    match_type?: "relationship" | "friendship";
    user1_liked_user2?: boolean;
    user2_liked_user1?: boolean;
};

type DailyCronDryRunResponse = {
    usersBeforeFeedbackGate?: number;
    feedbackGateBlockedCount?: number;
    usersAfterFeedbackGate?: number;
    pairsFound?: number;
    totalMatchesWouldCreate?: number;
    mondayDropPreview?: MondayPreviewRow[];
    mondayDropPreviewCount?: number;
    mondayDropTotalPairs?: number;
    failureBreakdown?: Array<{ reason: string; count: number }>;
    keyMetrics?: Array<{ label: string; value: number }>;
    poolAnalytics?: {
        genderDistribution?: ChartDatum[];
        sexualityDistribution?: ChartDatum[];
        relationshipTypeDistribution?: ChartDatum[];
        ageDistribution?: ChartDatum[];
        topInterests?: ChartDatum[];
    };
    romanticMatchesWouldCreate?: number;
    friendshipMatchesWouldCreate?: number;
};

const WEEKLY_DROP_UTC_HOUR = 8;

const isWeeklyDecisionWindowOpenNow = () => {
    const now = new Date();
    const daysSinceMonday = (now.getUTCDay() + 6) % 7;
    const thisMondayAt8UTC = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysSinceMonday,
        WEEKLY_DROP_UTC_HOUR,
        0,
        0,
        0
    );
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const cycleStart = now.getTime() >= thisMondayAt8UTC ? thisMondayAt8UTC : thisMondayAt8UTC - weekMs;
    const mondayDecisionWindowEnd = cycleStart + (16 * 60 * 60 * 1000);
    return now.getTime() >= cycleStart && now.getTime() < mondayDecisionWindowEnd;
};

const loadPrivilegedUserIds = async (): Promise<Set<string>> => {
    const { data: roleRows, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "test"]);

    if (error) throw error;
    return new Set((roleRows || []).map((row: { user_id: string }) => row.user_id));
};

const CHART_COLORS = ["#7c3aed", "#2563eb", "#0d9488", "#f59e0b", "#ef4444", "#db2777", "#6b7280", "#14b8a6"];
const INTEREST_LABELS: Record<string, string> = {
    A: "Music / Concerts",
    B: "Movies/TV Series",
    C: "Reading / Books",
    D: "Fashion & Style",
    E: "Performing arts",
    F: "Photography",
    G: "Writing / Poetry",
    H: "Gym / Fitness",
    I: "Dance",
    J: "Hiking / Nature Walks",
    K: "Team sports",
    L: "Yoga / Pilates",
    M: "Swimming",
    N: "Running / Jogging",
    O: "Cycling",
    P: "Skiing",
    Q: "Surfing",
    R: "Traveling / Exploring Cities",
    S: "Foodie (Restaurants, cooking)",
    T: "Coffee culture / Cafes",
    U: "Wine / Cocktails",
    V: "Nightlife / Clubbing",
    W: "Festivals / Events",
    X: "Psychology / Self-growth",
    Y: "Spirituality / Meditation",
    Z: "Philosophy / Deep conversations",
    AA: "Tech / Startups",
    AB: "Science / Research",
    AC: "Politics & Current Affairs",
    AD: "Gaming",
    AE: "Comedy / Stand-up",
    AF: "DIY",
    AG: "Crafts",
    AH: "Volunteering / Activism",
};

const humanizeInterest = (value?: string) => {
    if (!value) return "-";
    return INTEREST_LABELS[value] || value;
};

const isStudentEmail = (email?: string | null): boolean => {
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) return false;
    const domain = normalized.split("@")[1];
    return domain === "uzh.ch" || domain.endsWith(".uzh.ch") || domain === "ethz.ch" || domain.endsWith(".ethz.ch");
};

const OPEN_TO_LABELS: Record<string, string> = {
    A: "Men",
    B: "Women",
    C: "Non-binary",
};

const FRIENDSHIP_OPEN_TO_LABELS: Record<string, string> = {
    A: "Women",
    B: "Men",
    C: "Non-binary people",
};

const GENDER_LABELS: Record<string, string> = { A: "Woman", B: "Man", C: "Non-binary", D: "Prefer not to say" };

const normalizeGenderCode = (raw?: string): string | undefined => {
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
};

const parseOptionsMap = (raw: unknown): OptionMap => {
    if (!raw) return {};
    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return {};
        const out: OptionMap = {};
        parsed.forEach((item: any) => {
            if (item?.value != null && item?.label != null) {
                out[String(item.value)] = String(item.label);
            }
        });
        return out;
    } catch {
        return {};
    }
};

const withFallbackMap = (primary: OptionMap, fallback: OptionMap): OptionMap =>
    Object.keys(primary).length > 0 ? primary : fallback;

const normalizeText = (value: string): string =>
    value.toLowerCase().replace(/\s+/g, " ").trim();

const parseOpenToCodes = (raw?: string): string[] => {
    if (!raw) return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return parsed.map((v) => String(v).trim()).filter(Boolean);
        }
    } catch {
        // ignore JSON parse errors and fallback to token split
    }
    return trimmed
        .replace(/\[/g, "")
        .replace(/\]/g, "")
        .replace(/"/g, "")
        .replace(/'/g, "")
        .split(/[,;| ]+/)
        .map((v) => v.trim())
        .filter(Boolean);
};

const normalizeCodesWithLabelMap = (codes: string[], labelMap: Record<string, string>): string[] => {
    const inverseMap: Record<string, string> = {};
    Object.entries(labelMap).forEach(([code, label]) => {
        inverseMap[normalizeText(code)] = code;
        inverseMap[normalizeText(label)] = code;
    });
    return codes
        .map((code) => inverseMap[normalizeText(String(code))] || String(code).trim())
        .filter(Boolean);
};

const formatOpenToFromRaw = (
    raw: string | undefined,
    labelMap: Record<string, string>,
    emptyLabel: string
): string => {
    const codes = parseOpenToCodes(raw);
    if (codes.length === 0) return emptyLabel;
    return codes.map((c) => labelMap[c] || c).join(", ");
};

const isBinaryGender = (genderCode?: string) => genderCode === "A" || genderCode === "B";

const classifyRomanticOrientation = (genderCode: string | undefined, openToCodes: string[]): string => {
    if (!genderCode || openToCodes.length === 0) return "Unknown";
    const unique = Array.from(new Set(normalizeCodesWithLabelMap(openToCodes, OPEN_TO_LABELS)));
    const hasMen = unique.includes("A");
    const hasWomen = unique.includes("B");
    const hasNb = unique.includes("C");

    if (isBinaryGender(genderCode)) {
        const same = genderCode === "A" ? hasWomen : hasMen;
        const opposite = genderCode === "A" ? hasMen : hasWomen;
        if (same && !opposite && !hasNb) return "Homo";
        if (opposite && !same && !hasNb) return "Hetero";
        if (same && opposite && !hasNb) return "Bisexual";
        if (hasNb || (same && opposite)) return "Pansexual";
        return "Other";
    }

    if (hasNb || unique.length >= 2) return "Pansexual";
    return "Other";
};

const classifyFriendshipPreference = (genderCode: string | undefined, openToCodes: string[]): string => {
    const normalized = normalizeCodesWithLabelMap(openToCodes, FRIENDSHIP_OPEN_TO_LABELS);
    if (!genderCode || normalized.length === 0) return "Unknown";
    if (!isBinaryGender(genderCode)) return "Other / Non-binary user";

    const unique = Array.from(new Set(normalized));
    const hasWomen = unique.includes("A");
    const hasMen = unique.includes("B");
    const same = genderCode === "A" ? hasWomen : hasMen;
    const opposite = genderCode === "A" ? hasMen : hasWomen;

    if (same && opposite) return "Both sexes";
    if (same) return "Same sex";
    if (opposite) return "Opposite sex";
    return "Unknown";
};

export const AdminMatchesTab = () => {
    const { toast } = useToast();
    const [allMatches, setAllMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCleaningCrossGroup, setIsCleaningCrossGroup] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [mondayInsights, setMondayInsights] = useState<DailyCronDryRunResponse | null>(null);
    const [friendshipInsights, setFriendshipInsights] = useState<DailyCronDryRunResponse | null>(null);
    const [previewMode, setPreviewMode] = useState<"romantic" | "friendship">("romantic");
    const [studentSexualityDistribution, setStudentSexualityDistribution] = useState<ChartDatum[]>([]);
    const [studentSurveyStats, setStudentSurveyStats] = useState({
        totalStudents: 0,
        activeStudents: 0,
        eligibleStudents: 0,
        friendshipEligibleStudents: 0,
        romanticCompleted: 0,
        friendshipCompleted: 0,
    });
    const [matchTypeStats, setMatchTypeStats] = useState({
        romantic: 0,
        friendship: 0,
    });
    const [matchTypeFilter, setMatchTypeFilter] = useState<"all" | "relationship" | "friendship">("all");

    // Comparison / Dialog State
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [user1Answers, setUser1Answers] = useState<PersonalityAnswer[]>([]);
    const [user2Answers, setUser2Answers] = useState<PersonalityAnswer[]>([]);
    const [isComparisonOpen, setIsComparisonOpen] = useState(false);
    const [profileDialogUser, setProfileDialogUser] = useState<'user1' | 'user2' | null>(null);
    const [deletingPairKey, setDeletingPairKey] = useState<string | null>(null);
    const weeklyDecisionWindowOpen = isWeeklyDecisionWindowOpenNow();

    useEffect(() => {
        loadAllMatches();
        loadMondayInsights();
    }, []);

    useEffect(() => {
        // #region agent log
        fetch('http://127.0.0.1:7616/ingest/44f6a305-6db6-4a48-8b1f-7622a61ebe60', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Debug-Session-Id': '9fc03d',
            },
            body: JSON.stringify({
                sessionId: '9fc03d',
                runId: 'state',
                hypothesisId: 'B',
                location: 'src/components/admin/AdminMatchesTab.tsx:stateEffect',
                message: 'AdminMatchesTab state snapshot',
                data: {
                    previewMode,
                    hasMondayInsights: !!mondayInsights,
                    hasFriendshipInsights: !!friendshipInsights,
                    loading,
                    previewLoading,
                },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
    }, [previewMode, mondayInsights, friendshipInsights, loading, previewLoading]);

    const loadAllMatches = async () => {
        try {
            setLoading(true);
            const weeklyDecisionWindowOpen = isWeeklyDecisionWindowOpenNow();
            const [privilegedIds, { data: matchesData, error: matchesError }] = await Promise.all([
                loadPrivilegedUserIds(),
                supabase
                    .from("matches")
                    .select("id, user_id, matched_user_id, compatibility_score, match_type, from_algorithm")
                    .order("compatibility_score", { ascending: false }),
            ]);

            if (matchesError) throw matchesError;

            if (!matchesData || matchesData.length === 0) {
                setAllMatches([]);
                setMatchTypeStats({ romantic: 0, friendship: 0 });
                return;
            }

            const seenPairs = new Set<string>();
            const uniqueMatches = matchesData.filter(match => {
                const pairKey = [match.user_id, match.matched_user_id].sort().join('-');
                if (seenPairs.has(pairKey)) return false;
                seenPairs.add(pairKey);
                return true;
            });

            const userIds = new Set<string>();
            uniqueMatches.forEach(match => {
                userIds.add(match.user_id);
                userIds.add(match.matched_user_id);
            });

            const [
                { data: profilesData, error: profilesError },
                { data: privateData },
            ] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("id, first_name, age, additional_photos, created_at, bio")
                    .in("id", Array.from(userIds)),
                supabase
                    .from("private_profile_data" as any)
                    .select("user_id, last_name, email, latitude, longitude")
                    .in("user_id", Array.from(userIds)),
            ]);

            if (profilesError) throw profilesError;

            const privateByUser = new Map(
                (privateData || []).map((r: any) => [r.user_id, r])
            );
            const profilesMap = new Map();
            (profilesData || []).forEach((profile: any) => {
                profilesMap.set(profile.id, { ...profile, ...(privateByUser.get(profile.id) || {}) });
            });

            const filteredMatches = uniqueMatches.filter((match) => {
                if (privilegedIds.has(match.user_id) || privilegedIds.has(match.matched_user_id)) {
                    return false;
                }

                const user1Email = profilesMap.get(match.user_id)?.email;
                const user2Email = profilesMap.get(match.matched_user_id)?.email;
                if (!isStudentEmail(user1Email) || !isStudentEmail(user2Email)) {
                    return false;
                }

                if (match.from_algorithm !== "event" && !weeklyDecisionWindowOpen) {
                    return false;
                }

                return true;
            });

            setMatchTypeStats({
                romantic: filteredMatches.filter((m: any) => (m.match_type || "relationship") === "relationship").length,
                friendship: filteredMatches.filter((m: any) => m.match_type === "friendship").length,
            });

            const { data: likesData, error: likesError } = await supabase
                .from("likes")
                .select("user_id, liked_user_id")

            if (likesError) throw likesError;

            const { data: dislikesData, error: dislikesError } = await supabase
                .from("dislikes")
                .select("user_id, disliked_user_id")

            if (dislikesError) throw dislikesError;

            const { data: friendshipLikesData } = await supabase
                .from("friendship_likes")
                .select("user_id, liked_user_id");

            const { data: friendshipDislikesData } = await supabase
                .from("friendship_dislikes")
                .select("user_id, disliked_user_id");

            const likePairs = new Set<string>();
            likesData?.forEach(like => {
                likePairs.add(`${like.user_id}-${like.liked_user_id}`);
            });

            const friendshipLikePairs = new Set<string>();
            friendshipLikesData?.forEach(like => {
                friendshipLikePairs.add(`${like.user_id}-${like.liked_user_id}`);
            });

            const dislikePairs = new Set<string>();
            dislikesData?.forEach(dislike => {
                dislikePairs.add(`${dislike.user_id}-${dislike.disliked_user_id}`);
            });

            const friendshipDislikePairs = new Set<string>();
            friendshipDislikesData?.forEach(dislike => {
                friendshipDislikePairs.add(`${dislike.user_id}-${dislike.disliked_user_id}`);
            });

            const enrichedMatches = filteredMatches.map(match => ({
                ...(match.match_type === "friendship"
                    ? {
                        user1_liked_user2: friendshipLikePairs.has(`${match.user_id}-${match.matched_user_id}`),
                        user2_liked_user1: friendshipLikePairs.has(`${match.matched_user_id}-${match.user_id}`),
                        user1_disliked_user2: friendshipDislikePairs.has(`${match.user_id}-${match.matched_user_id}`),
                        user2_disliked_user1: friendshipDislikePairs.has(`${match.matched_user_id}-${match.user_id}`),
                    }
                    : {
                        user1_liked_user2: likePairs.has(`${match.user_id}-${match.matched_user_id}`),
                        user2_liked_user1: likePairs.has(`${match.matched_user_id}-${match.user_id}`),
                        user1_disliked_user2: dislikePairs.has(`${match.user_id}-${match.matched_user_id}`),
                        user2_disliked_user1: dislikePairs.has(`${match.matched_user_id}-${match.user_id}`),
                    }),
                id: match.id,
                user_id: match.user_id,
                matched_user_id: match.matched_user_id,
                compatibility_score: match.compatibility_score,
                match_type: match.match_type || "relationship",
                from_algorithm: match.from_algorithm || "relationship",
                user_profile: profilesMap.get(match.user_id) || null,
                matched_user_profile: profilesMap.get(match.matched_user_id) || null,
            }));

            setAllMatches(enrichedMatches);
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to load matches: " + error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleMatchClick = async (match: Match) => {
        setSelectedMatch(match);
        setIsComparisonOpen(true);

        try {
            const [{ data: user1Data }, { data: user2Data }] = await Promise.all([
                supabase
                    .from("personality_answers")
                    .select("question_number, answer, answer_custom")
                    .eq("user_id", match.user_id)
                    .order("question_number"),
                supabase
                    .from("personality_answers")
                    .select("question_number, answer, answer_custom")
                    .eq("user_id", match.matched_user_id)
                    .order("question_number")
            ]);

            setUser1Answers(user1Data || []);
            setUser2Answers(user2Data || []);
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to load personality answers",
                variant: "destructive",
            });
        }
    };

    const getAnswerForQuestion = (answers: PersonalityAnswer[], questionNumber: number) => {
        const answer = answers.find(a => a.question_number === questionNumber);
        return answer?.answer_custom || answer?.answer || "No answer";
    };

    const getPairKey = (userId: string, matchedUserId: string) => [userId, matchedUserId].sort().join("-");

    const handleCleanupCrossGroupMatches = async () => {
        if (!window.confirm("Delete all matches between test/admin users and regular users?")) return;
        setIsCleaningCrossGroup(true);

        try {
            const { data: roleRows, error: roleError } = await supabase
                .from("user_roles")
                .select("user_id, role")
                .in("role", ["admin", "test"]);
            if (roleError) throw roleError;

            const privilegedIds = new Set((roleRows || []).map((r: { user_id: string }) => r.user_id));

            const { data: matchesData, error: matchesError } = await supabase
                .from("matches")
                .select("user_id, matched_user_id");
            if (matchesError) throw matchesError;

            const pairKeys = new Set<string>();
            const pairsToDelete: Array<{ userA: string; userB: string }> = [];

            (matchesData || []).forEach((m: { user_id: string; matched_user_id: string }) => {
                const userAIsPrivileged = privilegedIds.has(m.user_id);
                const userBIsPrivileged = privilegedIds.has(m.matched_user_id);
                if (userAIsPrivileged === userBIsPrivileged) return;

                const key = getPairKey(m.user_id, m.matched_user_id);
                if (pairKeys.has(key)) return;
                pairKeys.add(key);

                const [userA, userB] = [m.user_id, m.matched_user_id].sort();
                pairsToDelete.push({ userA, userB });
            });

            if (pairsToDelete.length === 0) {
                toast({
                    title: "No cross-group matches found",
                    description: "Everything is already clean.",
                });
                return;
            }

            for (const pair of pairsToDelete) {
                const orClause = `and(user_id.eq.${pair.userA},matched_user_id.eq.${pair.userB}),and(user_id.eq.${pair.userB},matched_user_id.eq.${pair.userA})`;
                const { error: matchDeleteError } = await supabase
                    .from("matches")
                    .delete()
                    .or(orClause);
                if (matchDeleteError) throw matchDeleteError;

                const likesClause = `and(user_id.eq.${pair.userA},liked_user_id.eq.${pair.userB}),and(user_id.eq.${pair.userB},liked_user_id.eq.${pair.userA})`;
                const { error: likesDeleteError } = await supabase
                    .from("likes")
                    .delete()
                    .or(likesClause);
                if (likesDeleteError) throw likesDeleteError;

                const dislikesClause = `and(user_id.eq.${pair.userA},disliked_user_id.eq.${pair.userB}),and(user_id.eq.${pair.userB},disliked_user_id.eq.${pair.userA})`;
                const { error: dislikesDeleteError } = await supabase
                    .from("dislikes")
                    .delete()
                    .or(dislikesClause);
                if (dislikesDeleteError) throw dislikesDeleteError;

                const { error: friendshipLikesDeleteError } = await supabase
                    .from("friendship_likes")
                    .delete()
                    .or(likesClause);
                if (friendshipLikesDeleteError) throw friendshipLikesDeleteError;

                const { error: friendshipDislikesDeleteError } = await supabase
                    .from("friendship_dislikes")
                    .delete()
                    .or(dislikesClause);
                if (friendshipDislikesDeleteError) throw friendshipDislikesDeleteError;
            }

            setAllMatches((prev) =>
                prev.filter((m) => {
                    const userAIsPrivileged = privilegedIds.has(m.user_id);
                    const userBIsPrivileged = privilegedIds.has(m.matched_user_id);
                    return userAIsPrivileged === userBIsPrivileged;
                })
            );

            toast({
                title: "Cleanup complete",
                description: `Deleted ${pairsToDelete.length} cross-group match pair(s).`,
            });
        } catch (error: any) {
            toast({
                title: "Cleanup failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsCleaningCrossGroup(false);
        }
    };

    const handleDeleteMatch = async (match: Match) => {
        const userA = match.user_profile?.first_name || "User A";
        const userB = match.matched_user_profile?.first_name || "User B";
        if (!window.confirm(`Delete match between ${userA} and ${userB}?`)) return;

        const pairKey = getPairKey(match.user_id, match.matched_user_id);
        setDeletingPairKey(pairKey);

        try {
            const { error: matchDeleteError } = await supabase
                .from("matches")
                .delete()
                .or(`and(user_id.eq.${match.user_id},matched_user_id.eq.${match.matched_user_id}),and(user_id.eq.${match.matched_user_id},matched_user_id.eq.${match.user_id})`);
            if (matchDeleteError) throw matchDeleteError;

            // Also clear mutual interaction state for this pair to avoid immediate rematch/date side-effects in testing.
            const { error: likesDeleteError } = await supabase
                .from("likes")
                .delete()
                .or(`and(user_id.eq.${match.user_id},liked_user_id.eq.${match.matched_user_id}),and(user_id.eq.${match.matched_user_id},liked_user_id.eq.${match.user_id})`);
            if (likesDeleteError) throw likesDeleteError;

            const { error: dislikesDeleteError } = await supabase
                .from("dislikes")
                .delete()
                .or(`and(user_id.eq.${match.user_id},disliked_user_id.eq.${match.matched_user_id}),and(user_id.eq.${match.matched_user_id},disliked_user_id.eq.${match.user_id})`);
            if (dislikesDeleteError) throw dislikesDeleteError;

            const { error: friendshipLikesDeleteError } = await supabase
                .from("friendship_likes")
                .delete()
                .or(`and(user_id.eq.${match.user_id},liked_user_id.eq.${match.matched_user_id}),and(user_id.eq.${match.matched_user_id},liked_user_id.eq.${match.user_id})`);
            if (friendshipLikesDeleteError) throw friendshipLikesDeleteError;

            const { error: friendshipDislikesDeleteError } = await supabase
                .from("friendship_dislikes")
                .delete()
                .or(`and(user_id.eq.${match.user_id},disliked_user_id.eq.${match.matched_user_id}),and(user_id.eq.${match.matched_user_id},disliked_user_id.eq.${match.user_id})`);
            if (friendshipDislikesDeleteError) throw friendshipDislikesDeleteError;

            setAllMatches((prev) => prev.filter((m) => getPairKey(m.user_id, m.matched_user_id) !== pairKey));
            if (selectedMatch && getPairKey(selectedMatch.user_id, selectedMatch.matched_user_id) === pairKey) {
                setIsComparisonOpen(false);
                setSelectedMatch(null);
            }

            toast({
                title: "Match deleted",
                description: `Removed ${userA} and ${userB} from each other's matches.`,
            });
        } catch (error: any) {
            toast({
                title: "Delete failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setDeletingPairKey(null);
        }
    };

    const loadMondayInsights = async () => {
        try {
            setPreviewLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            const authHeaders = session?.access_token
                ? { Authorization: `Bearer ${session.access_token}` }
                : {};

            const [{ data: romanticRaw, error: romanticError }, { data: friendshipRaw, error: friendshipError }] = await Promise.all([
                supabase.functions.invoke("daily-cron", {
                    headers: authHeaders,
                    body: {
                        dry_run: true,
                        force_weekly_drop: true,
                        debug_all: false,
                        compact: true,
                        preview_limit: 5000,
                        refresh_requested_at: new Date().toISOString(),
                    },
                }),
                supabase.functions.invoke("match-users", {
                    body: {},
                    headers: {
                        ...authHeaders,
                        "x-algorithm": "friendship",
                        "dry-run": "true",
                        "x-send-emails": "false",
                        "x-max-matches-per-user": "5",
                    },
                }),
            ]);
            if (romanticError) {
                console.error("daily-cron error (non-fatal for admin preview):", romanticError, (romanticError as any)?.context);
            }
            if (friendshipError) {
                console.error("match-users (friendship) error (non-fatal for admin preview):", friendshipError, (friendshipError as any)?.context);
            }

            // #region agent log
            fetch('http://127.0.0.1:7616/ingest/44f6a305-6db6-4a48-8b1f-7622a61ebe60', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Debug-Session-Id': '9fc03d',
                },
                body: JSON.stringify({
                    sessionId: '9fc03d',
                    runId: 'functions',
                    hypothesisId: 'C',
                    location: 'src/components/admin/AdminMatchesTab.tsx:loadMondayInsights:functions',
                    message: 'Results from daily-cron and match-users invocations',
                    data: {
                        romanticErrorMessage: romanticError?.message ?? null,
                        friendshipErrorMessage: friendshipError?.message ?? null,
                        romanticHasData: romanticRaw != null,
                        friendshipHasData: friendshipRaw != null,
                    },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion

            const romanticInsights = !romanticError
                ? ((typeof romanticRaw === "string" ? JSON.parse(romanticRaw) : romanticRaw) || null) as DailyCronDryRunResponse | null
                : null;
            const friendshipData = !friendshipError
                ? (typeof friendshipRaw === "string" ? JSON.parse(friendshipRaw) : friendshipRaw)
                : null;

            const privilegedIds = await loadPrivilegedUserIds();

            const [
                { data: profilesData, error: profilesError },
                { data: privateProfilesData },
            ] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("id, first_name, age, completed_questionnaire, completed_friendship_questionnaire, is_paused"),
                supabase
                    .from("private_profile_data" as any)
                    .select("user_id, last_name, email"),
            ]);
            if (profilesError) throw profilesError;

            const privateProfilesMap = new Map(
                (privateProfilesData || []).map((r: any) => [r.user_id, r])
            );
            const mergedProfilesData = (profilesData || []).map((p: any) => ({
                ...p,
                ...(privateProfilesMap.get(p.id) || {}),
            }));
            const realProfilesData = mergedProfilesData.filter((profile: any) => !privilegedIds.has(profile.id));

            const { data: storedMatchesRows, error: storedMatchesError } = await supabase
                .from("matches")
                .select("user_id, matched_user_id, compatibility_score, match_type")
                .order("compatibility_score", { ascending: false });
            if (storedMatchesError) throw storedMatchesError;

            const studentProfiles = realProfilesData.filter((p: any) => isStudentEmail(p.email));
            const activeStudentProfiles = studentProfiles.filter((p: any) => p.is_paused !== true);
            const romanticSurveyCompletedStudents = studentProfiles.filter((p: any) => p.completed_questionnaire === true);
            const friendshipSurveyCompletedStudents = studentProfiles.filter((p: any) => p.completed_friendship_questionnaire === true);

            const romanticEligibleStudents = realProfilesData.filter((p: any) =>
                p.completed_questionnaire === true && p.is_paused !== true && isStudentEmail(p.email)
            );
            const friendshipEligibleStudents = realProfilesData.filter((p: any) =>
                p.completed_friendship_questionnaire === true && p.is_paused !== true && isStudentEmail(p.email)
            );

            setStudentSurveyStats({
                totalStudents: studentProfiles.length,
                activeStudents: activeStudentProfiles.length,
                eligibleStudents: romanticEligibleStudents.length,
                friendshipEligibleStudents: friendshipEligibleStudents.length,
                romanticCompleted: romanticSurveyCompletedStudents.length,
                friendshipCompleted: friendshipSurveyCompletedStudents.length,
            });

            const romanticIds = romanticEligibleStudents.map((p: any) => p.id);
            const friendshipIds = friendshipEligibleStudents.map((p: any) => p.id);
            const allIds = Array.from(new Set([...romanticIds, ...friendshipIds]));

            const [
                { data: personalityAnswersRows, error: personalityAnswersError },
                { data: friendshipAnswersRows, error: friendshipAnswersError },
                { data: romanticQuestions, error: romanticQuestionsError },
                { data: friendshipQuestions, error: friendshipQuestionsError },
            ] = await Promise.all([
                supabase
                    .from("personality_answers")
                    .select("user_id, question_number, answer")
                    .in("user_id", allIds)
                    .in("question_number", [16, 17, 18, 32]),
                supabase
                    .from("friendship_answers")
                    .select("user_id, question_number, question_id, answer")
                    .in("user_id", allIds),
                supabase
                    .from("questionnaire_questions")
                    .select("id, options")
                    .in("id", [17, 18]),
                supabase
                    .from("friendship_questions")
                    .select("id, question, options, order_index"),
            ]);
            if (personalityAnswersError) throw personalityAnswersError;
            if (romanticQuestionsError) throw romanticQuestionsError;
            if (friendshipAnswersError) {
                console.warn("friendship_answers read blocked in client; using edge-function payload fallback", friendshipAnswersError);
            }
            if (friendshipQuestionsError) {
                console.warn("friendship_questions read failed in client; using defaults", friendshipQuestionsError);
            }

            const personalityAnswersByUser = new Map<string, Record<number, string>>();
            (personalityAnswersRows || []).forEach((row: any) => {
                const curr = personalityAnswersByUser.get(row.user_id) || {};
                curr[row.question_number] = row.answer || "";
                personalityAnswersByUser.set(row.user_id, curr);
            });
            const friendshipAnswersByUser = new Map<string, Record<number, string>>();
            const friendshipAnswerRowsByUser = new Map<string, Array<{ question_number: number; question_id?: number | null; answer: string }>>();
            (friendshipAnswersRows || []).forEach((row: any) => {
                const curr = friendshipAnswersByUser.get(row.user_id) || {};
                curr[row.question_number] = row.answer || "";
                friendshipAnswersByUser.set(row.user_id, curr);
                const rows = friendshipAnswerRowsByUser.get(row.user_id) || [];
                rows.push({
                    question_number: row.question_number,
                    question_id: row.question_id,
                    answer: row.answer || "",
                });
                friendshipAnswerRowsByUser.set(row.user_id, rows);
            });

            const romanticOpenToOptions = withFallbackMap(
                parseOptionsMap((romanticQuestions || []).find((q: any) => q.id === 17)?.options),
                OPEN_TO_LABELS
            );
            const romanticIntentOptions = parseOptionsMap((romanticQuestions || []).find((q: any) => q.id === 18)?.options);
            const friendshipQuestionRows = friendshipQuestions || [];
            const friendshipQuestionById = new Map<number, any>(
                friendshipQuestionRows.map((q: any) => [q.id, q])
            );
            const friendshipQuestionByOrder = new Map<number, any>(
                friendshipQuestionRows
                    .filter((q: any) => q.order_index != null)
                    .map((q: any) => [Number(q.order_index), q])
            );
            const findFriendshipQuestionIdByOrder = (orderIndex: number) =>
                friendshipQuestionRows.find((q: any) => q.order_index === orderIndex)?.id;
            const findFriendshipQuestionIdByOptionLabels = (expected: string[]) => {
                const normalized = expected.map(normalizeText).sort();
                for (const q of friendshipQuestionRows) {
                    const optionsMap = parseOptionsMap(q.options);
                    const labels = Object.values(optionsMap).map((v) => normalizeText(v)).sort();
                    if (labels.length === normalized.length && labels.every((v, i) => v === normalized[i])) {
                        return q.id;
                    }
                }
                return undefined;
            };
            const friendshipQuestionIdByKind = {
                gender: findFriendshipQuestionIdByOrder(1) ?? friendshipQuestionRows.find((q: any) => /identify.*gender/i.test(q.question || ""))?.id ?? 16,
                openTo: findFriendshipQuestionIdByOrder(2) ?? friendshipQuestionRows.find((q: any) => /open to.*friends|preferred gender.*friend/i.test(q.question || ""))?.id ?? 17,
                intent:
                    friendshipQuestionRows.find((q: any) => /kind of friendship|friendship.*looking for/i.test(q.question || ""))?.id
                    ?? findFriendshipQuestionIdByOptionLabels(["Casual and light", "Consistent and reliable", "Deep and meaningful", "Open and flexible"])
                    ?? findFriendshipQuestionIdByOrder(3),
                // Interests are in question 7 in friendship flow.
                interests: findFriendshipQuestionIdByOrder(7) ?? friendshipQuestionRows.find((q: any) => /things.*really into|interests|hobbies|activities/i.test(q.question || ""))?.id,
            };
            const getFriendshipAnswerForKind = (
                userId: string,
                kind: "gender" | "openTo" | "intent" | "interests"
            ): string | undefined => {
                const rows = friendshipAnswerRowsByUser.get(userId) || [];
                const targetId = friendshipQuestionIdByKind[kind];
                const resolveQuestionFromRow = (row: { question_number: number; question_id?: number | null; answer: string }) => {
                    if (row.question_id != null && friendshipQuestionById.has(Number(row.question_id))) {
                        return friendshipQuestionById.get(Number(row.question_id));
                    }
                    if (friendshipQuestionById.has(Number(row.question_number))) {
                        return friendshipQuestionById.get(Number(row.question_number));
                    }
                    if (friendshipQuestionByOrder.has(Number(row.question_number))) {
                        return friendshipQuestionByOrder.get(Number(row.question_number));
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
                        ? /identify.*gender/i
                        : kind === "openTo"
                            ? /open to.*friends|preferred gender.*friend/i
                            : kind === "intent"
                                ? /kind of friendship|friendship.*looking for/i
                                : /interests|hobbies|activities/i;

                const fallback = rows.find((r) => {
                    const q = resolveQuestionFromRow(r);
                    const text = q?.question || "";
                    return matcher.test(text);
                });
                return fallback?.answer;
            };
            const friendshipOpenToOptions = withFallbackMap(
                parseOptionsMap(friendshipQuestionRows.find((q: any) => q.id === friendshipQuestionIdByKind.openTo)?.options),
                FRIENDSHIP_OPEN_TO_LABELS
            );
            const friendshipIntentOptions = parseOptionsMap(
                friendshipQuestionRows.find((q: any) => q.id === friendshipQuestionIdByKind.intent)?.options
            );

            const buildPoolAnalytics = (poolProfiles: any[], mode: "romantic" | "friendship") => {
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
                const toChart = (counts: Record<string, number>) =>
                    Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

                poolProfiles.forEach((profile: any) => {
                    const romanticAns = personalityAnswersByUser.get(profile.id) || {};
                    const friendshipAns = friendshipAnswersByUser.get(profile.id) || {};

                    const genderCodeRaw = mode === "friendship"
                        ? (getFriendshipAnswerForKind(profile.id, "gender") || friendshipAns[friendshipQuestionIdByKind.gender] || romanticAns[16])
                        : romanticAns[16];
                    const genderCode = normalizeGenderCode(genderCodeRaw);
                    const genderLabel = GENDER_LABELS[genderCode] || "Unknown";
                    genderCounts[genderLabel] = (genderCounts[genderLabel] || 0) + 1;

                    const openRaw = mode === "friendship"
                        ? (getFriendshipAnswerForKind(profile.id, "openTo") || friendshipAns[friendshipQuestionIdByKind.openTo])
                        : romanticAns[17];
                    const openCodes = parseOpenToCodes(openRaw || "");
                    if (openCodes.length === 0) {
                        const emptyLabel = "Unknown";
                        openToCounts[emptyLabel] = (openToCounts[emptyLabel] || 0) + 1;
                    } else {
                        const genderCodeRaw = mode === "friendship"
                            ? (getFriendshipAnswerForKind(profile.id, "gender") || friendshipAns[friendshipQuestionIdByKind.gender] || romanticAns[16])
                            : romanticAns[16];
                        const genderCode = normalizeGenderCode(genderCodeRaw);
                        const label = mode === "friendship"
                            ? classifyFriendshipPreference(genderCode, openCodes)
                            : classifyRomanticOrientation(genderCode, openCodes);
                        openToCounts[label] = (openToCounts[label] || 0) + 1;
                    }

                    const intentCode = mode === "friendship"
                        ? (
                            getFriendshipAnswerForKind(profile.id, "intent")
                            || (friendshipQuestionIdByKind.intent ? friendshipAns[friendshipQuestionIdByKind.intent] : undefined)
                        )
                        : romanticAns[18];
                    if (intentCode) {
                        const intentOptions = mode === "friendship" ? friendshipIntentOptions : romanticIntentOptions;
                        const intentCodes = parseOpenToCodes(intentCode);
                        if (intentCodes.length > 0) {
                            intentCodes.forEach((code) => {
                                const intentLabel = intentOptions[code] || code;
                                intentCounts[intentLabel] = (intentCounts[intentLabel] || 0) + 1;
                            });
                        } else {
                            const intentLabel = intentOptions[intentCode] || intentCode;
                            intentCounts[intentLabel] = (intentCounts[intentLabel] || 0) + 1;
                        }
                    }

                    const interestsRaw = mode === "friendship"
                        ? (
                            getFriendshipAnswerForKind(profile.id, "interests")
                                || (friendshipQuestionIdByKind.interests
                                ? friendshipAns[friendshipQuestionIdByKind.interests]
                                : romanticAns[32]
                                )
                        )
                        : romanticAns[32];
                    const interests = (interestsRaw || "").split(",").map((v: string) => v.trim()).filter(Boolean);
                    interests.forEach((i: string) => {
                        interestCounts[i] = (interestCounts[i] || 0) + 1;
                    });

                    if (typeof profile.age === "number") {
                        const bucket = ageBuckets.find((b) => profile.age >= b.min && profile.age <= b.max);
                        if (bucket) bucket.count += 1;
                    }
                });

                return {
                    genderDistribution: toChart(genderCounts),
                    sexualityDistribution: toChart(openToCounts),
                    relationshipTypeDistribution: toChart(intentCounts),
                    ageDistribution: ageBuckets.map(({ label, count }) => ({ label, count })),
                    topInterests: toChart(interestCounts).slice(0, 8),
                };
            };

            const romanticPoolAnalytics = buildPoolAnalytics(romanticEligibleStudents, "romantic");
            const friendshipPoolAnalytics = buildPoolAnalytics(friendshipEligibleStudents, "friendship");
            setStudentSexualityDistribution(romanticPoolAnalytics.sexualityDistribution || []);

            const profileById = new Map<string, any>();
            realProfilesData.forEach((p: any) => {
                profileById.set(p.id, p);
            });

            const seenStoredPairs = new Set<string>();
            const dedupedStoredPairs = (storedMatchesRows || []).filter((row: any) => {
                if (privilegedIds.has(row.user_id) || privilegedIds.has(row.matched_user_id)) {
                    return false;
                }
                const type = row.match_type || "relationship";
                const pairKey = `${type}:${[row.user_id, row.matched_user_id].sort().join("-")}`;
                if (seenStoredPairs.has(pairKey)) return false;
                seenStoredPairs.add(pairKey);
                return true;
            });

            const romanticPreview = dedupedStoredPairs
                .filter((r: any) => (r.match_type || "relationship") === "relationship")
                .map((row: any) => {
                    const user1Profile = profileById.get(row.user_id);
                    const user2Profile = profileById.get(row.matched_user_id);
                    const a1 = row.user_id ? personalityAnswersByUser.get(row.user_id)?.[17] : undefined;
                    const a2 = row.matched_user_id ? personalityAnswersByUser.get(row.matched_user_id)?.[17] : undefined;
                    return {
                        user1_name: user1Profile?.first_name || "-",
                        user1_email: user1Profile?.email || "-",
                        user2_name: user2Profile?.first_name || "-",
                        user2_email: user2Profile?.email || "-",
                        compatibility_score: row.compatibility_score,
                        user1_open_to_dating: formatOpenToFromRaw(a1, romanticOpenToOptions, "No romantic open-to answer"),
                        user2_open_to_dating: formatOpenToFromRaw(a2, romanticOpenToOptions, "No romantic open-to answer"),
                        user1_gender: GENDER_LABELS[personalityAnswersByUser.get(row.user_id)?.[16] || ""] || "Unknown",
                        user2_gender: GENDER_LABELS[personalityAnswersByUser.get(row.matched_user_id)?.[16] || ""] || "Unknown",
                        user1_liked_user2: false,
                        user2_liked_user1: false,
                        match_type: "relationship" as const,
                    };
                });

            // #region agent log
            fetch('http://127.0.0.1:7616/ingest/44f6a305-6db6-4a48-8b1f-7622a61ebe60',{
                method:'POST',
                headers:{
                    'Content-Type':'application/json',
                    'X-Debug-Session-Id':'9fc03d',
                },
                body:JSON.stringify({
                    sessionId:'9fc03d',
                    runId:'initial',
                    hypothesisId:'A',
                    location:'src/components/admin/AdminMatchesTab.tsx:romanticPreview',
                    message:'Monday preview vs stored matches counts',
                    data:{
                        romanticPairsFound: romanticInsights?.pairsFound ?? null,
                        romanticTotalMatchesWouldCreate: romanticInsights?.totalMatchesWouldCreate ?? null,
                        romanticDryRunPreviewCount: romanticInsights?.mondayDropPreviewCount ?? null,
                        storedMatchesRows: storedMatchesRows?.length ?? 0,
                        dedupedStoredPairs: dedupedStoredPairs.length,
                        romanticPreviewCount: romanticPreview.length,
                        allMatchesCardCount: allMatches.length,
                    },
                    timestamp:Date.now(),
                }),
            }).catch(()=>{});
            // #endregion

            setMondayInsights({
                ...(romanticInsights || {}),
                mondayDropPreview: romanticPreview,
                mondayDropPreviewCount: romanticPreview.length,
                mondayDropTotalPairs: romanticPreview.length,
                poolAnalytics: romanticPoolAnalytics as any,
            });

            const friendshipMatches = dedupedStoredPairs
                .filter((r: any) => (r.match_type || "relationship") === "friendship")
                .map((m: any) => {
                const user1Id = m.user_id;
                const user2Id = m.matched_user_id;
                const user1Profile = profileById.get(user1Id);
                const user2Profile = profileById.get(user2Id);
                const user1OpenRaw = user1Id
                    ? (getFriendshipAnswerForKind(user1Id, "openTo") || friendshipAnswersByUser.get(user1Id)?.[friendshipQuestionIdByKind.openTo])
                    : undefined;
                const user2OpenRaw = user2Id
                    ? (getFriendshipAnswerForKind(user2Id, "openTo") || friendshipAnswersByUser.get(user2Id)?.[friendshipQuestionIdByKind.openTo])
                    : undefined;

                return {
                    user1_name: user1Profile?.first_name || "-",
                    user1_email: user1Profile?.email || "-",
                    user2_name: user2Profile?.first_name || "-",
                    user2_email: user2Profile?.email || "-",
                    compatibility_score: m.compatibility_score,
                    user1_gender: m.user1_gender || (user1Id
                        ? (GENDER_LABELS[getFriendshipAnswerForKind(user1Id, "gender") || ""] || "Unknown")
                        : "Unknown"),
                    user2_gender: m.user2_gender || (user2Id
                        ? (GENDER_LABELS[getFriendshipAnswerForKind(user2Id, "gender") || ""] || "Unknown")
                        : "Unknown"),
                    user1_open_to_dating: m.user1_open_to_dating || formatOpenToFromRaw(user1OpenRaw, friendshipOpenToOptions, "No friendship open-to answer"),
                    user2_open_to_dating: m.user2_open_to_dating || formatOpenToFromRaw(user2OpenRaw, friendshipOpenToOptions, "No friendship open-to answer"),
                    user1_liked_user2: false,
                    user2_liked_user1: false,
                    match_type: "friendship" as const,
                };
            });
            const friendshipFailures = friendshipData?.stats?.friendship?.failures || {};
            const friendshipPairsChecked =
                friendshipData?.stats?.friendship?.processed_count
                ?? friendshipData?.stats?.processed_count
                ?? 0;
            const friendshipFailureBreakdown = Object.entries(friendshipFailures)
                .map(([reason, count]) => ({ reason, count: Number(count) }))
                .sort((a, b) => b.count - a.count);
            const friendshipAvg = friendshipMatches.length > 0
                ? Math.round(friendshipMatches.reduce((s: number, m: any) => s + (m.compatibility_score || 0), 0) / friendshipMatches.length)
                : 0;

            setFriendshipInsights({
                usersBeforeFeedbackGate: friendshipEligibleStudents.length,
                feedbackGateBlockedCount: 0,
                usersAfterFeedbackGate: friendshipEligibleStudents.length,
                mondayDropPreview: friendshipMatches,
                mondayDropPreviewCount: friendshipMatches.length,
                mondayDropTotalPairs: friendshipMatches.length,
                failureBreakdown: friendshipFailureBreakdown,
                poolAnalytics: (friendshipData?.friendship_pool_analytics || friendshipPoolAnalytics) as any,
                keyMetrics: [
                    { label: "Eligible Student Users In Pool", value: friendshipEligibleStudents.length },
                    { label: "Friendship Pairs Checked", value: friendshipPairsChecked },
                    { label: "Friendship Pairs Passing Core Filters", value: friendshipData?.candidates?.length || 0 },
                    { label: "Preview Pairs For Monday", value: friendshipMatches.length },
                    { label: "Friendship Matches Would Be Created", value: friendshipMatches.length },
                    { label: "Avg Compatibility (Preview)", value: friendshipAvg },
                ],
            });

            // #region agent log
            fetch('http://127.0.0.1:7616/ingest/44f6a305-6db6-4a48-8b1f-7622a61ebe60', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Debug-Session-Id': '9fc03d',
                },
                body: JSON.stringify({
                    sessionId: '9fc03d',
                    runId: 'postSet',
                    hypothesisId: 'B',
                    location: 'src/components/admin/AdminMatchesTab.tsx:afterSetInsights',
                    message: 'After setting monday and friendship insights',
                    data: {
                        mondayDropPreviewCount: romanticPreview.length,
                        friendshipPreviewCount: friendshipMatches.length,
                        previewModeAtSet: previewMode,
                    },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion
        } catch (error: any) {
            // #region agent log
            fetch('http://127.0.0.1:7616/ingest/44f6a305-6db6-4a48-8b1f-7622a61ebe60', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Debug-Session-Id': '9fc03d',
                },
                body: JSON.stringify({
                    sessionId: '9fc03d',
                    runId: 'error',
                    hypothesisId: 'C',
                    location: 'src/components/admin/AdminMatchesTab.tsx:loadMondayInsights:catch',
                    message: 'loadMondayInsights threw before setting insights',
                    data: {
                        errorMessage: error?.message ?? null,
                    },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion

            toast({
                title: "Could not load Monday preview",
                description: error.message || "daily-cron dry-run failed.",
                variant: "destructive",
            });
        } finally {
            setPreviewLoading(false);
        }
    };

    const allQuestions = [...new Set([...user1Answers, ...user2Answers].map(a => a.question_number))].sort((a, b) => a - b);
    const activeInsights = previewMode === "romantic" ? mondayInsights : friendshipInsights;
    const previewRows = activeInsights?.mondayDropPreview || [];
    const previewAverageCompatibility = previewRows.length > 0
        ? Math.round(
            previewRows.reduce((sum, row) => sum + Number(row.compatibility_score || 0), 0) / previewRows.length
        )
        : 0;
    const fallbackKeyMetrics = previewMode === "romantic"
        ? [
            { label: "Eligible Before Feedback Gate", value: activeInsights?.usersBeforeFeedbackGate ?? studentSurveyStats.eligibleStudents },
            { label: "Blocked By Feedback Gate", value: activeInsights?.feedbackGateBlockedCount ?? 0 },
            { label: "Eligible After Feedback Gate", value: activeInsights?.usersAfterFeedbackGate ?? studentSurveyStats.eligibleStudents },
            { label: "Pairs Checked", value: activeInsights?.pairsFound ?? 0 },
            { label: "Preview Pairs For Monday", value: activeInsights?.mondayDropPreviewCount ?? activeInsights?.mondayDropTotalPairs ?? previewRows.length },
            { label: "Romantic Matches Would Be Created", value: activeInsights?.romanticMatchesWouldCreate ?? activeInsights?.totalMatchesWouldCreate ?? (previewRows.length * 2) },
            { label: "Avg Compatibility (Preview)", value: previewAverageCompatibility },
        ]
        : [
            { label: "Eligible Student Users In Pool", value: studentSurveyStats.friendshipEligibleStudents },
            { label: "Friendship Pairs Checked", value: activeInsights?.pairsFound ?? 0 },
            { label: "Preview Pairs For Monday", value: activeInsights?.mondayDropPreviewCount ?? activeInsights?.mondayDropTotalPairs ?? previewRows.length },
            { label: "Friendship Matches Would Be Created", value: activeInsights?.friendshipMatchesWouldCreate ?? (previewRows.length * 2) },
            { label: "Avg Compatibility (Preview)", value: previewAverageCompatibility },
        ];
    const resolvedKeyMetrics = (activeInsights?.keyMetrics && activeInsights.keyMetrics.length > 0)
        ? activeInsights.keyMetrics
        : fallbackKeyMetrics;
    const fallbackSexualityDistribution = (() => {
        if (!previewRows.length) return [];
        const counts: Record<string, number> = {};
        for (const row of previewRows) {
            const user1 = (row.user1_open_to_dating || "Unknown").trim() || "Unknown";
            const user2 = (row.user2_open_to_dating || "Unknown").trim() || "Unknown";
            counts[user1] = (counts[user1] || 0) + 1;
            counts[user2] = (counts[user2] || 0) + 1;
        }
        return Object.entries(counts)
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count);
    })();
    const sexualityDistribution = (previewMode === "romantic" && studentSexualityDistribution.length > 0)
        ? studentSexualityDistribution
        : ((activeInsights?.poolAnalytics?.sexualityDistribution || []).length > 0
            ? (activeInsights?.poolAnalytics?.sexualityDistribution || [])
            : fallbackSexualityDistribution);
    const intentDistribution = activeInsights?.poolAnalytics?.relationshipTypeDistribution || [];
    const topKeyMetrics = resolvedKeyMetrics.filter((metric) => {
        if (previewMode === "friendship") return true;
        if (/friendship/i.test(metric.label)) return false;
        if (/total matches would be created/i.test(metric.label)) return false;
        return true;
    });
    const surveyOverviewCards = previewMode === "romantic"
        ? [
            { label: "Student Profiles", value: studentSurveyStats.totalStudents },
            { label: "Active Student Profiles", value: studentSurveyStats.activeStudents },
            { label: "Romantic Survey Done", value: studentSurveyStats.romanticCompleted },
            { label: "Friendship Survey Done", value: studentSurveyStats.friendshipCompleted },
        ]
        : [
            { label: "Student Profiles", value: studentSurveyStats.totalStudents },
            { label: "Active Student Profiles", value: studentSurveyStats.activeStudents },
            { label: "Romantic Survey Done", value: studentSurveyStats.romanticCompleted },
            { label: "Friendship Survey Done", value: studentSurveyStats.friendshipCompleted },
        ];
    const openToSectionTitle = previewMode === "romantic"
        ? "Romantic Orientation (Student Users)"
        : "Friendship Preference Type (Student Users)";
    const intentSectionTitle = previewMode === "romantic"
        ? "Relationship Intent (Eligible Pool)"
        : "Friendship Intent (Eligible Pool)";
    const openToLabel = previewMode === "romantic" ? "Open to dating" : "Open to being friends with";

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading matches...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Profile View Dialog */}
            <ProfileViewDialog
                open={!!profileDialogUser}
                onOpenChange={() => setProfileDialogUser(null)}
                profile={
                    profileDialogUser === 'user1' ? selectedMatch?.user_profile : selectedMatch?.matched_user_profile
                }
                showAdminInfo
                matchType={selectedMatch?.match_type || "relationship"}
                compatibilityWithUserId={
                    profileDialogUser === 'user1'
                        ? selectedMatch?.matched_user_id || null
                        : profileDialogUser === 'user2'
                            ? selectedMatch?.user_id || null
                            : null
                }
            />

            {/* Comparison Dialog */}
            <Dialog open={isComparisonOpen} onOpenChange={setIsComparisonOpen}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Personality Answer Comparison
                        </DialogTitle>
                        {selectedMatch && (
                            <div className="space-y-4 pt-4">
                                <div className="flex justify-between items-center">
                                    <div className="text-center">
                                        <p className="font-semibold text-lg">
                                            {selectedMatch.user_profile?.first_name} {selectedMatch.user_profile?.last_name}
                                        </p>
                                        {selectedMatch.user1_liked_user2 && (
                                            <p className="text-xs text-green-600 mt-1">Liked their match</p>
                                        )}
                                        {selectedMatch.user1_disliked_user2 && (
                                            <p className="text-xs text-red-600 mt-1">Disliked their match</p>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-2"
                                            onClick={() => setProfileDialogUser('user1')}
                                        >
                                            View Profile
                                        </Button>
                                    </div>
                                    <div className="text-primary font-bold">
                                        {selectedMatch.compatibility_score}% Match
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-lg">
                                            {selectedMatch.matched_user_profile?.first_name} {selectedMatch.matched_user_profile?.last_name}
                                        </p>
                                        {selectedMatch.user2_liked_user1 && (
                                            <p className="text-xs text-green-600 mt-1">Liked their match</p>
                                        )}
                                        {selectedMatch.user2_disliked_user1 && (
                                            <p className="text-xs text-red-600 mt-1">Disliked their match</p>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-2"
                                            onClick={() => setProfileDialogUser('user2')}
                                        >
                                            View Profile
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        {allQuestions.map((questionNumber) => (
                            <div key={questionNumber} className="border-b pb-4">
                                <h3 className="font-semibold mb-3">Question {questionNumber}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-muted p-4 rounded-lg">
                                        <p className="text-sm">
                                            {getAnswerForQuestion(user1Answers, questionNumber)}
                                        </p>
                                    </div>
                                    <div className="bg-muted p-4 rounded-lg">
                                        <p className="text-sm">
                                            {getAnswerForQuestion(user2Answers, questionNumber)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            <CardTitle>Monday Drop Insights</CardTitle>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadMondayInsights}
                            disabled={previewLoading}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${previewLoading ? "animate-spin" : ""}`} />
                            Refresh Preview
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {activeInsights ? (
                        <>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={previewMode === "romantic" ? "default" : "outline"}
                                    onClick={() => setPreviewMode("romantic")}
                                >
                                    Romantic
                                </Button>
                                <Button
                                    size="sm"
                                    variant={previewMode === "friendship" ? "default" : "outline"}
                                    onClick={() => setPreviewMode("friendship")}
                                >
                                    Friendship
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                                {topKeyMetrics.map((metric) => (
                                    <Card key={metric.label} className="border-border/60">
                                        <CardContent className="p-3">
                                            <p className="text-xs text-muted-foreground">{metric.label}</p>
                                            <p className="text-xl font-semibold">{metric.value}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {surveyOverviewCards.map((metric) => (
                                    <Card key={metric.label} className="border-border/60">
                                        <CardContent className="p-3">
                                            <p className="text-xs text-muted-foreground">{metric.label}</p>
                                            <p className="text-xl font-semibold">{metric.value}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Gender Distribution (Eligible Pool)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="min-h-[340px] md:h-[250px]">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
                                            <div className="h-[170px] md:h-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={activeInsights.poolAnalytics?.genderDistribution || []}
                                                        dataKey="count"
                                                        nameKey="label"
                                                        outerRadius="78%"
                                                        innerRadius="52%"
                                                        label={false}
                                                    >
                                                        {(activeInsights.poolAnalytics?.genderDistribution || []).map((entry, idx) => (
                                                            <Cell key={`${entry.label}-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div className="space-y-2 overflow-auto pr-1">
                                                {(activeInsights.poolAnalytics?.genderDistribution || []).map((entry, idx) => (
                                                    <div key={entry.label} className="flex items-center justify-between text-sm rounded border px-2 py-1">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="inline-block h-2.5 w-2.5 rounded-full"
                                                                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                                            />
                                                            <span>{entry.label}</span>
                                                        </div>
                                                        <span className="font-semibold">{entry.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">{openToSectionTitle}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="min-h-[340px] md:h-[250px]">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
                                            {sexualityDistribution.length === 0 ? (
                                                <div className="col-span-2 flex items-center justify-center text-sm text-muted-foreground">
                                                    No open-to distribution available for this preview.
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="h-[170px] md:h-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={sexualityDistribution}
                                                                dataKey="count"
                                                                nameKey="label"
                                                                outerRadius="78%"
                                                                innerRadius="52%"
                                                                label={false}
                                                            >
                                                                {sexualityDistribution.map((entry, idx) => (
                                                                    <Cell key={`${entry.label}-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip />
                                                        </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                    <div className="space-y-2 overflow-auto pr-1">
                                                        {sexualityDistribution.map((entry, idx) => (
                                                            <div key={entry.label} className="flex items-center justify-between text-sm rounded border px-2 py-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        className="inline-block h-2.5 w-2.5 rounded-full"
                                                                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                                                    />
                                                                    <span>{entry.label}</span>
                                                                </div>
                                                                <span className="font-semibold">{entry.count}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {(activeInsights.poolAnalytics?.sexualityDistribution || []).length === 0 && sexualityDistribution.length > 0 && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Showing preview-sample distribution (from visible Monday preview pairs).
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">{intentSectionTitle}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[220px]">
                                        {intentDistribution.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md">
                                                No intent data available in eligible users yet.
                                            </div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={intentDistribution}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-10} height={50} />
                                                    <YAxis allowDecimals={false} />
                                                    <Tooltip />
                                                    <Bar dataKey="count" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Age Buckets (Eligible Pool)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[220px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={activeInsights.poolAnalytics?.ageDistribution || []}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="label" />
                                                <YAxis allowDecimals={false} />
                                                <Tooltip />
                                                <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Failure Breakdown (Why Pairs Fail)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
                                            {(activeInsights.failureBreakdown || []).length === 0 ? (
                                                <div className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
                                                    No failure reasons returned yet for this mode. Click Refresh Preview to recompute.
                                                </div>
                                            ) : (
                                                (activeInsights.failureBreakdown || []).map((row) => (
                                                    <div key={row.reason} className="flex items-center justify-between rounded-md border px-3 py-2">
                                                        <span className="text-sm">{row.reason}</span>
                                                        <span className="font-semibold">{row.count}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Top Interests (Eligible Pool)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
                                            {(activeInsights.poolAnalytics?.topInterests || []).map((row) => (
                                                <div key={row.label} className="flex items-center justify-between rounded-md border px-3 py-2">
                                                    <span className="text-sm">{humanizeInterest(row.label)}</span>
                                                    <span className="font-semibold">{row.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Monday Match Preview ({activeInsights.mondayDropTotalPairs || 0} total pairs)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="max-h-[360px] overflow-auto rounded-md border">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 bg-muted">
                                                <tr className="text-left">
                                                    <th className="px-3 py-2">User 1</th>
                                                    <th className="px-3 py-2">User 2</th>
                                                    <th className="px-3 py-2">Score</th>
                                                    <th className="px-3 py-2">Type</th>
                                                    <th className="px-3 py-2">Interaction</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(activeInsights.mondayDropPreview || []).map((row, idx) => (
                                                    <tr key={`${row.user1_email}-${row.user2_email}-${idx}`} className="border-t">
                                                        <td className="px-3 py-2">
                                                            <div className="font-medium">{row.user1_name || "-"}</div>
                                                            <div className="text-muted-foreground">{row.user1_email || "-"}</div>
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                {row.user1_gender || "Unknown"} • {openToLabel}: {row.user1_open_to_dating || "Unknown"}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="font-medium">{row.user2_name || "-"}</div>
                                                            <div className="text-muted-foreground">{row.user2_email || "-"}</div>
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                {row.user2_gender || "Unknown"} • {openToLabel}: {row.user2_open_to_dating || "Unknown"}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 font-semibold">{row.compatibility_score ?? "-"}</td>
                                                        <td className="px-3 py-2 text-muted-foreground">
                                                            {row.match_type === "friendship" ? "Friendship" : "Romantic"}
                                                        </td>
                                                        <td className="px-3 py-2 text-muted-foreground">
                                                            {row.user1_liked_user2 || row.user2_liked_user1 ? "Prior like exists" : "No prior like"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <div className="text-sm text-muted-foreground">
                            No preview loaded yet. Click <span className="font-medium">Refresh Preview</span>.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <CardTitle>All User Matches ({allMatches.filter(m => matchTypeFilter === "all" || (m.match_type || "relationship") === matchTypeFilter).length})</CardTitle>
                        <div className="flex items-center gap-2">
                            <div className="flex rounded-md border overflow-hidden text-xs">
                                <button
                                    className={`px-3 py-1 ${matchTypeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                                    onClick={() => setMatchTypeFilter("all")}
                                >
                                    All ({allMatches.length})
                                </button>
                                <button
                                    className={`px-3 py-1 border-l ${matchTypeFilter === "relationship" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                                    onClick={() => setMatchTypeFilter("relationship")}
                                >
                                    Romantic ({matchTypeStats.romantic})
                                </button>
                                <button
                                    className={`px-3 py-1 border-l ${matchTypeFilter === "friendship" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                                    onClick={() => setMatchTypeFilter("friendship")}
                                >
                                    Friendship ({matchTypeStats.friendship})
                                </button>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleCleanupCrossGroupMatches}
                            disabled={isCleaningCrossGroup}
                        >
                            {isCleaningCrossGroup ? "Cleaning..." : "Delete Cross-Group Matches"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {!weeklyDecisionWindowOpen && (
                        <p className="mb-4 text-sm text-muted-foreground">
                            Weekly matches are hidden here once the Monday decision window closes. Event matches remain visible.
                        </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {allMatches.filter(m => matchTypeFilter === "all" || (m.match_type || "relationship") === matchTypeFilter).map((match) => (
                            <Card
                                key={match.id}
                                className="cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => handleMatchClick(match)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-primary">
                                            {match.compatibility_score}% Match
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <div className="text-xs text-muted-foreground">
                                                {match.user1_liked_user2 && match.user2_liked_user1 ? (
                                                    <span className="text-green-600">Both liked</span>
                                                ) : match.user1_liked_user2 ? (
                                                    <span>{match.user_profile?.first_name} liked</span>
                                                ) : match.user2_liked_user1 ? (
                                                    <span>{match.matched_user_profile?.first_name} liked</span>
                                                ) : match.user1_disliked_user2 && match.user2_disliked_user1 ? (
                                                    <span className="text-red-600">Both disliked</span>
                                                ) : match.user1_disliked_user2 ? (
                                                    <span className="text-red-600">{match.user_profile?.first_name} disliked</span>
                                                ) : match.user2_disliked_user1 ? (
                                                    <span className="text-red-600">{match.matched_user_profile?.first_name} disliked</span>
                                                ) : (
                                                    <span className="text-orange-600">No interactions yet</span>
                                                )}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7 text-destructive hover:text-destructive"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteMatch(match);
                                                }}
                                                disabled={deletingPairKey === getPairKey(match.user_id, match.matched_user_id)}
                                                title="Delete Match"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-4 mb-3">
                                        <img
                                            src={match.user_profile?.additional_photos?.[0] || "/placeholder.svg"}
                                            alt={match.user_profile?.first_name}
                                            className="w-16 h-16 rounded-full object-cover"
                                        />
                                        <div>
                                            <p className="font-semibold">
                                                {match.user_profile?.first_name} {match.user_profile?.last_name}
                                            </p>
                                            {match.user_profile?.age && (
                                                <p className="text-sm text-muted-foreground">
                                                    Age {match.user_profile.age}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <img
                                            src={match.matched_user_profile?.additional_photos?.[0] || "/placeholder.svg"}
                                            alt={match.matched_user_profile?.first_name}
                                            className="w-16 h-16 rounded-full object-cover"
                                        />
                                        <div>
                                            <p className="font-semibold">
                                                {match.matched_user_profile?.first_name} {match.matched_user_profile?.last_name}
                                            </p>
                                            {match.matched_user_profile?.age && (
                                                <p className="text-sm text-muted-foreground">
                                                    Age {match.matched_user_profile.age}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
