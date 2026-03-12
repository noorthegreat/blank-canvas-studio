import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type ChartDatum = {
    label: string;
    count: number;
};

type ProfileStats = {
    total: number;
    active: number;
    paused: number;
    students: number;
    romanticSurveyCompleted: number;
    friendshipSurveyCompleted: number;
    growthData: Array<{ date: string; count: number; displayDate: string }>;
    statusDistribution: ChartDatum[];
    studentDistribution: ChartDatum[];
    genderDistribution: ChartDatum[];
    sexualityDistribution: ChartDatum[];
    friendshipPreferenceDistribution: ChartDatum[];
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

const FRIENDSHIP_GENDER_LABELS: Record<string, string> = {
    A: "Woman",
    B: "Man",
    C: "Non-binary",
    D: "Prefer not to say",
};

const isBinaryGender = (genderCode?: string) => genderCode === "A" || genderCode === "B";

const normalizeText = (value: string): string => value.toLowerCase().replace(/\s+/g, " ").trim();

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
        // Ignore parse errors and fallback to token split.
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

const classifyFriendshipPreference = (genderCode: string | undefined, openToCodes: string[]): string => {
    const normalized = normalizeCodesWithLabelMap(openToCodes, {
        A: "Women",
        B: "Men",
        C: "Non-binary people",
    });
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

const toChartData = (counts: Record<string, number>): ChartDatum[] =>
    Object.entries(counts)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

export const useAdminStats = () => {
    const { toast } = useToast();
    const [profileStats, setProfileStats] = useState<ProfileStats>({
        total: 0,
        active: 0,
        paused: 0,
        students: 0,
        romanticSurveyCompleted: 0,
        friendshipSurveyCompleted: 0,
        growthData: [],
        statusDistribution: [],
        studentDistribution: [],
        genderDistribution: [],
        sexualityDistribution: [],
        friendshipPreferenceDistribution: [],
    });
    const [loading, setLoading] = useState(true);

    const loadProfileStats = async () => {
        try {
            setLoading(true);
            const [{ data: profiles, error: profilesError }, { data: privateRows }] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, created_at, is_paused, completed_questionnaire, completed_friendship_questionnaire')
                    .order('created_at', { ascending: true }),
                supabase
                    .from('private_profile_data' as any)
                    .select('user_id, email'),
            ]);

            if (profilesError) throw profilesError;

            const privateByUser = new Map((privateRows || []).map((r: any) => [r.user_id, r]));
            const profilesWithEmail = (profiles || []).map((p: any) => ({
                ...p,
                email: privateByUser.get(p.id)?.email ?? null,
            }));

            const { data: answerRows, error: answersError } = await supabase
                .from('personality_answers')
                .select('user_id, question_number, answer')
                .in('question_number', [16, 17]);

            if (answersError) throw answersError;

            const [{ data: friendshipAnswerRows, error: friendshipAnswersError }, { data: friendshipQuestions, error: friendshipQuestionsError }] = await Promise.all([
                supabase
                    .from('friendship_answers')
                    .select('user_id, question_number, question_id, answer'),
                supabase
                    .from('friendship_questions')
                    .select('id, question, order_index')
            ]);
            if (friendshipAnswersError) throw friendshipAnswersError;
            if (friendshipQuestionsError) throw friendshipQuestionsError;

            // @ts-ignore
            const { data: deletedUsers, error: deletedError } = await supabase
                .from('deleted_users')
                .select('user_created_at, deleted_at') as any;

            if (deletedError) {
                console.error("Error loading deleted users:", deletedError);
            }

            if (profilesWithEmail) {
                let cumulativeCount = 0;
                const growthMap = new Map<string, number>();
                const answersByUser = new Map<string, Record<number, string>>();
                const friendshipAnswersByUser = new Map<string, Array<{ question_number: number; question_id?: number | null; answer: string }>>();
                const genderCounts: Record<string, number> = {};
                const sexualityCounts: Record<string, number> = {};
                const friendshipPreferenceCounts: Record<string, number> = {};
                const genderLabels: Record<string, string> = {
                    A: "Woman",
                    B: "Man",
                    C: "Non-binary",
                    D: "Prefer not to say",
                };

                (answerRows || []).forEach((row: any) => {
                    const userAnswers = answersByUser.get(row.user_id) || {};
                    userAnswers[row.question_number] = row.answer;
                    answersByUser.set(row.user_id, userAnswers);
                });
                (friendshipAnswerRows || []).forEach((row: any) => {
                    const rows = friendshipAnswersByUser.get(row.user_id) || [];
                    rows.push({
                        question_number: row.question_number,
                        question_id: row.question_id,
                        answer: row.answer || "",
                    });
                    friendshipAnswersByUser.set(row.user_id, rows);
                });

                const friendshipQuestionRows = friendshipQuestions || [];
                const friendshipQuestionById = new Map<number, any>(friendshipQuestionRows.map((q: any) => [q.id, q]));
                const friendshipQuestionByOrder = new Map<number, any>(
                    friendshipQuestionRows
                        .filter((q: any) => q.order_index != null)
                        .map((q: any) => [Number(q.order_index), q])
                );
                const getFqIdByOrder = (order: number) => friendshipQuestionRows.find((q: any) => q.order_index === order)?.id;
                const fqGenderId = getFqIdByOrder(1) ?? friendshipQuestionRows.find((q: any) => /identify.*gender/i.test(q.question || ""))?.id;
                const fqOpenToId = getFqIdByOrder(2) ?? friendshipQuestionRows.find((q: any) => /open to.*friends|preferred gender.*friend/i.test(q.question || ""))?.id;
                const getFriendshipAnswer = (userId: string, kind: "gender" | "openTo") => {
                    const rows = friendshipAnswersByUser.get(userId) || [];
                    const targetId = kind === "gender" ? fqGenderId : fqOpenToId;
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
                    const matcher = kind === "gender" ? /identify.*gender/i : /open to.*friends|preferred gender.*friend/i;
                    return rows.find((r) => {
                        const q = resolveQuestionFromRow(r);
                        return matcher.test(q?.question || "");
                    })?.answer;
                };

                profilesWithEmail.forEach(profile => {
                    if (profile.created_at) {
                        const date = format(new Date(profile.created_at), 'yyyy-MM-dd');
                        growthMap.set(date, (growthMap.get(date) || 0) + 1);
                    }

                    const answers = answersByUser.get(profile.id);
                    const friendshipGenderCode = normalizeGenderCode(getFriendshipAnswer(profile.id, "gender"));
                    const resolvedGenderCode = normalizeGenderCode(answers?.[16]) || friendshipGenderCode;
                    const genderLabel = genderLabels[resolvedGenderCode] || FRIENDSHIP_GENDER_LABELS[resolvedGenderCode] || "Unknown";
                    genderCounts[genderLabel] = (genderCounts[genderLabel] || 0) + 1;

                    if (profile.completed_questionnaire === true) {
                        const sexualitySelections = parseOpenToCodes(answers?.[17] || "");
                        const orientation = classifyRomanticOrientation(
                            normalizeGenderCode(answers?.[16]) || friendshipGenderCode,
                            sexualitySelections
                        );
                        sexualityCounts[orientation] = (sexualityCounts[orientation] || 0) + 1;
                    }

                    if (profile.completed_friendship_questionnaire === true) {
                        const friendshipOpenTo = parseOpenToCodes(getFriendshipAnswer(profile.id, "openTo") || "");
                        const pref = classifyFriendshipPreference(resolvedGenderCode, friendshipOpenTo);
                        friendshipPreferenceCounts[pref] = (friendshipPreferenceCounts[pref] || 0) + 1;
                    }
                });

                if (deletedUsers) {
                    deletedUsers.forEach((user: any) => {
                        // Add +1 for when they joined (even if they are now deleted, they contributed to growth back then)
                        if (user.user_created_at) {
                            const joinDate = format(new Date(user.user_created_at), 'yyyy-MM-dd');
                            growthMap.set(joinDate, (growthMap.get(joinDate) || 0) + 1);
                        }

                        // Add -1 for when they were deleted
                        if (user.deleted_at) {
                            const leaveDate = format(new Date(user.deleted_at), 'yyyy-MM-dd');
                            growthMap.set(leaveDate, (growthMap.get(leaveDate) || 0) - 1);
                        }
                    });
                }

                const growthData = Array.from(growthMap.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([date, count]) => {
                        cumulativeCount += count;
                        return {
                            date,
                            count: cumulativeCount,
                            displayDate: format(new Date(date), 'MMM d')
                        };
                    });

                const paused = profilesWithEmail.filter((p: any) => p.is_paused === true).length;
                const active = profilesWithEmail.length - paused;
                const students = profilesWithEmail.filter((p: any) => isStudentEmail(p.email)).length;
                const romanticSurveyCompleted = profilesWithEmail.filter((p: any) => p.completed_questionnaire === true).length;
                const friendshipSurveyCompleted = profilesWithEmail.filter((p: any) => p.completed_friendship_questionnaire === true).length;

                setProfileStats({
                    total: profilesWithEmail.length,
                    active,
                    paused,
                    students,
                    romanticSurveyCompleted,
                    friendshipSurveyCompleted,
                    growthData,
                    statusDistribution: toChartData({
                        Active: active,
                        Paused: paused,
                    }),
                    studentDistribution: toChartData({
                        Student: students,
                        "Non-student": profilesWithEmail.length - students,
                    }),
                    genderDistribution: toChartData(genderCounts),
                    sexualityDistribution: toChartData(sexualityCounts),
                    friendshipPreferenceDistribution: toChartData(friendshipPreferenceCounts),
                });
            }
        } catch (error: any) {
            console.error('Error loading profile stats:', error);
            toast({
                title: "Error",
                description: "Failed to load profile statistics",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfileStats();
    }, []);

    return { profileStats, loading, refreshStats: loadProfileStats };
};
