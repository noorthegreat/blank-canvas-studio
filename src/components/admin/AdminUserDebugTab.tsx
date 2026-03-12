import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type DebugUser = {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    completed_questionnaire?: boolean;
    completed_friendship_questionnaire?: boolean;
};

type MatchRow = {
    user1_id: string;
    user2_id: string;
    user1_name?: string;
    user2_name?: string;
    user1_email?: string;
    user2_email?: string;
    compatibility_score?: number;
    user1_liked_user2?: boolean;
    user2_liked_user1?: boolean;
};

type ModeResult = {
    mode: "relationship" | "friendship";
    selectedMatches: MatchRow[];
    candidateMatches: MatchRow[];
    failureBreakdown: Array<{ reason: string; count: number }>;
    processedDebugPairs: number;
};

const modeLabel = (mode: "relationship" | "friendship") => mode === "relationship" ? "Romantic" : "Friendship";

const displayUserName = (u?: DebugUser | null) => {
    if (!u) return "-";
    const full = `${u.first_name || ""} ${u.last_name || ""}`.trim();
    return full || u.email || u.id;
};

export const AdminUserDebugTab = () => {
    const { toast } = useToast();
    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [users, setUsers] = useState<DebugUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<DebugUser | null>(null);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<Record<string, ModeResult>>({});
    const [existingMatches, setExistingMatches] = useState<Record<string, MatchRow[]>>({});
    const [loadingMatches, setLoadingMatches] = useState(false);

    const canRunRomantic = !!selectedUser?.completed_questionnaire;
    const canRunFriendship = !!selectedUser?.completed_friendship_questionnaire;

    const searchUsers = async () => {
        if (!query.trim()) return;
        setSearching(true);
        try {
            const { data, error } = await supabase.functions.invoke("admin-search-users", {
                body: { query: query.trim() },
            });
            if (error) throw error;
            setUsers((data?.users || []) as DebugUser[]);
        } catch (error: any) {
            toast({
                title: "Search failed",
                description: error?.message || "Could not search users.",
                variant: "destructive",
            });
        } finally {
            setSearching(false);
        }
    };

    const fetchCurrentMatchesForUser = async (user: DebugUser) => {
        setLoadingMatches(true);
        try {
            const { data, error } = await supabase
                .from("matches")
                .select("user_id, matched_user_id, compatibility_score, match_type")
                .eq("user_id", user.id)
                .order("compatibility_score", { ascending: false });
            if (error) throw error;
            const partnerIds = Array.from(new Set((data || []).map((m: any) => m.matched_user_id)));
            if (partnerIds.length === 0) {
                setExistingMatches({});
                return;
            }
            const [{ data: profiles, error: profileError }, { data: privateRows }] = await Promise.all([
                supabase.from("profiles").select("id, first_name").in("id", partnerIds),
                supabase.from("private_profile_data" as any).select("user_id, last_name, email").in("user_id", partnerIds),
            ]);
            if (profileError) throw profileError;
            const privateByUser = new Map((privateRows || []).map((r: any) => [r.user_id, r]));
            const pMap = new Map(
                (profiles || []).map((p: any) => [
                    p.id,
                    { ...p, last_name: privateByUser.get(p.id)?.last_name ?? null, email: privateByUser.get(p.id)?.email ?? null },
                ])
            );
            const rows = (data || []).map((m: any) => ({
                user1_id: m.user_id,
                user2_id: m.matched_user_id,
                user1_name: user.first_name,
                user1_email: user.email,
                user2_name: pMap.get(m.matched_user_id)?.first_name,
                user2_email: pMap.get(m.matched_user_id)?.email,
                compatibility_score: m.compatibility_score,
                match_type: m.match_type,
            })) as (MatchRow & { match_type?: string | null })[];

            const grouped: Record<string, MatchRow[]> = {};
            for (const row of rows) {
                const key = row.match_type || "unknown";
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(row);
            }
            setExistingMatches(grouped);
        } catch (err: any) {
            toast({ title: "Could not load current matches", description: err?.message, variant: "destructive" });
        } finally {
            setLoadingMatches(false);
        }
    };

    const runModeDebug = async (mode: "relationship" | "friendship", userId: string): Promise<ModeResult> => {
        const { data, error } = await supabase.functions.invoke("match-users", {
            body: { debug_user_id: userId },
            headers: {
                "dry-run": "true",
                "x-algorithm": mode,
                "x-send-emails": "false",
                "x-max-matches-per-user": "5",
            },
        });
        if (error) throw error;
        const payload = typeof data === "string" ? JSON.parse(data) : data;

        const selected = ((payload?.matches || []) as MatchRow[]).filter(
            (row) => row.user1_id === userId || row.user2_id === userId
        );
        const candidates = ((payload?.candidates || []) as MatchRow[]).filter(
            (row) => row.user1_id === userId || row.user2_id === userId
        );

        const userFailures = payload?.stats?.[mode]?.user_failures || {};
        const failureBreakdown = Object.entries(userFailures)
            .map(([reason, count]) => ({ reason, count: Number(count) || 0 }))
            .sort((a, b) => b.count - a.count);

        return {
            mode,
            selectedMatches: selected,
            candidateMatches: candidates,
            failureBreakdown,
            processedDebugPairs: Number(payload?.stats?.[mode]?.processed_debug_pairs || 0),
        };
    };

    const runDebug = async () => {
        if (!selectedUser) return;
        setRunning(true);
        setResults({});
        try {
            const nextResults: Record<string, ModeResult> = {};

            await Promise.all([
                canRunRomantic ? runModeDebug("relationship", selectedUser.id).then(r => { nextResults.relationship = r; }) : Promise.resolve(),
                canRunFriendship ? runModeDebug("friendship", selectedUser.id).then(r => { nextResults.friendship = r; }) : Promise.resolve(),
            ]);

            setResults(nextResults);

            if (!canRunRomantic && !canRunFriendship) {
                toast({
                    title: "No survey completed",
                    description: "This user has not completed romantic or friendship survey yet.",
                });
            }
        } catch (error: any) {
            toast({
                title: "Debug run failed",
                description: error?.message || "Could not run debug.",
                variant: "destructive",
            });
        } finally {
            setRunning(false);
        }
    };

    const activeModes = useMemo(() => {
        const modes: Array<"relationship" | "friendship"> = [];
        if (canRunRomantic) modes.push("relationship");
        if (canRunFriendship) modes.push("friendship");
        return modes;
    }, [canRunRomantic, canRunFriendship]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>User Match Debug</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name, email, or user id"
                            onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                        />
                        <Button onClick={searchUsers} disabled={searching || !query.trim()}>
                            {searching ? "Searching..." : "Search"}
                        </Button>
                    </div>

                    {users.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {users.map((u) => (
                                <button
                                    key={u.id}
                                    type="button"
                                    className={`rounded border px-3 py-2 text-left ${selectedUser?.id === u.id ? "border-primary bg-primary/5" : "border-border"}`}
                                    onClick={() => { setSelectedUser(u); setResults({}); fetchCurrentMatchesForUser(u); }}
                                >
                                    <div className="font-medium">{displayUserName(u)}</div>
                                    <div className="text-xs text-muted-foreground break-all">{u.email}</div>
                                    <div className="text-xs text-muted-foreground">
                                        Romantic: {u.completed_questionnaire ? "Yes" : "No"} | Friendship: {u.completed_friendship_questionnaire ? "Yes" : "No"}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedUser && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded border p-3">
                            <div>
                                <div className="font-medium">Selected: {displayUserName(selectedUser)}</div>
                                <div className="text-xs text-muted-foreground break-all">{selectedUser.id}</div>
                            </div>
                            <Button onClick={runDebug} disabled={running}>
                                {running ? "Running debug..." : "Run Debug"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {selectedUser && (
                <Card>
                    <CardHeader>
                        <CardTitle>Current Active Matches</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingMatches ? (
                            <div className="text-sm text-muted-foreground">Loading matches...</div>
                        ) : Object.keys(existingMatches).length === 0 ? (
                            <div className="text-sm text-muted-foreground">No current active matches.</div>
                        ) : (
                            <div className="space-y-4">
                                {(["relationship", "friendship", "unknown"] as const).filter(k => existingMatches[k]?.length).map((key) => (
                                    <div key={key}>
                                        <div className="font-medium mb-2">{key === "relationship" ? "Romantic" : key === "friendship" ? "Friendship" : "Other"} ({existingMatches[key].length})</div>
                                        <div className="overflow-auto rounded border">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/40">
                                                    <tr>
                                                        <th className="text-left px-3 py-2">Partner</th>
                                                        <th className="text-left px-3 py-2">Score</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {existingMatches[key].map((row) => (
                                                        <tr key={`${row.user1_id}-${row.user2_id}`} className="border-t">
                                                            <td className="px-3 py-2">
                                                                <div className="font-medium">{row.user2_name || "Unknown"}</div>
                                                                <div className="text-xs text-muted-foreground">{row.user2_email || "-"}</div>
                                                            </td>
                                                            <td className="px-3 py-2 font-semibold">{row.compatibility_score ?? "-"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {activeModes.map((mode) => {
                const result = results[mode];
                return (
                    <Card key={mode}>
                        <CardHeader>
                            <CardTitle>{modeLabel(mode)} Debug</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!result ? (
                                <div className="text-sm text-muted-foreground">Run debug to load {modeLabel(mode).toLowerCase()} analysis.</div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="rounded border p-3">
                                            <div className="text-xs text-muted-foreground">Pairs Checked</div>
                                            <div className="text-xl font-semibold">{result.processedDebugPairs}</div>
                                        </div>
                                        <div className="rounded border p-3">
                                            <div className="text-xs text-muted-foreground">Passing Core Filters</div>
                                            <div className="text-xl font-semibold">{result.candidateMatches.length}</div>
                                        </div>
                                        <div className="rounded border p-3">
                                            <div className="text-xs text-muted-foreground">Would Be Selected</div>
                                            <div className="text-xl font-semibold">{result.selectedMatches.length}</div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="font-medium mb-2">Failure Breakdown (Why they are not matching)</div>
                                        <div className="space-y-2 max-h-[260px] overflow-auto">
                                            {result.failureBreakdown.length === 0 ? (
                                                <div className="text-sm text-muted-foreground rounded border border-dashed px-3 py-2">
                                                    No blocking reason recorded for this user in this mode.
                                                </div>
                                            ) : (
                                                result.failureBreakdown.map((row) => (
                                                    <div key={row.reason} className="flex items-center justify-between rounded border px-3 py-2">
                                                        <span className="text-sm">{row.reason}</span>
                                                        <span className="font-semibold">{row.count}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="font-medium mb-2">Would Be Selected Matches (dry run)</div>
                                        <div className="overflow-auto rounded border">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/40">
                                                    <tr>
                                                        <th className="text-left px-3 py-2">Partner</th>
                                                        <th className="text-left px-3 py-2">Score</th>
                                                        <th className="text-left px-3 py-2">Interaction</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.selectedMatches.length === 0 ? (
                                                        <tr>
                                                            <td className="px-3 py-3 text-muted-foreground" colSpan={3}>No selected matches in this dry run.</td>
                                                        </tr>
                                                    ) : (
                                                        result.selectedMatches.map((row) => {
                                                            const isUser1 = row.user1_id === selectedUser?.id;
                                                            const partnerName = isUser1 ? row.user2_name : row.user1_name;
                                                            const partnerEmail = isUser1 ? row.user2_email : row.user1_email;
                                                            const userLiked = isUser1 ? row.user1_liked_user2 : row.user2_liked_user1;
                                                            const interaction = userLiked ? "Already liked" : "No prior like";
                                                            return (
                                                                <tr key={`${row.user1_id}-${row.user2_id}-selected`} className="border-t">
                                                                    <td className="px-3 py-2">
                                                                        <div className="font-medium">{partnerName || "Unknown"}</div>
                                                                        <div className="text-xs text-muted-foreground">{partnerEmail || "-"}</div>
                                                                    </td>
                                                                    <td className="px-3 py-2 font-semibold">{row.compatibility_score ?? "-"}</td>
                                                                    <td className="px-3 py-2">{interaction}</td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="font-medium mb-2">Passing Core Filters (candidate pool)</div>
                                        <div className="overflow-auto rounded border max-h-[320px]">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/40 sticky top-0">
                                                    <tr>
                                                        <th className="text-left px-3 py-2">Partner</th>
                                                        <th className="text-left px-3 py-2">Score</th>
                                                        <th className="text-left px-3 py-2">Interaction</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {result.candidateMatches.length === 0 ? (
                                                        <tr>
                                                            <td className="px-3 py-3 text-muted-foreground" colSpan={3}>No candidates passed core filters.</td>
                                                        </tr>
                                                    ) : (
                                                        result.candidateMatches.map((row) => {
                                                            const isUser1 = row.user1_id === selectedUser?.id;
                                                            const partnerName = isUser1 ? row.user2_name : row.user1_name;
                                                            const partnerEmail = isUser1 ? row.user2_email : row.user1_email;
                                                            const userLiked = isUser1 ? row.user1_liked_user2 : row.user2_liked_user1;
                                                            const interaction = userLiked ? "Already liked" : "No prior like";
                                                            return (
                                                                <tr key={`${row.user1_id}-${row.user2_id}-candidate`} className="border-t">
                                                                    <td className="px-3 py-2">
                                                                        <div className="font-medium">{partnerName || "Unknown"}</div>
                                                                        <div className="text-xs text-muted-foreground">{partnerEmail || "-"}</div>
                                                                    </td>
                                                                    <td className="px-3 py-2 font-semibold">{row.compatibility_score ?? "-"}</td>
                                                                    <td className="px-3 py-2">{interaction}</td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};
