import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Play, Bug, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const DryRunPanel = () => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isForcingWeeklyDrop, setIsForcingWeeklyDrop] = useState(false);
    const [debugUserId, setDebugUserId] = useState("b7fcb0f9-41c0-4c5d-87df-2fd08d539a91");
    const [algorithm, setAlgorithm] = useState("all");
    const [onlyShowDebugMatches, setOnlyShowDebugMatches] = useState(true);
    const [sendEmails, setSendEmails] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [weeklyDropResult, setWeeklyDropResult] = useState<any>(null);

    const runMatching = async (isDryRun: boolean = true) => {
        setIsLoading(true);
        setResults(null);
        try {
            const { data, error } = await supabase.functions.invoke('match-users', {
                body: { debug_user_id: debugUserId || undefined },
                headers: {
                    'x-algorithm': algorithm,
                    'dry-run': isDryRun ? 'true' : 'false',
                    'x-send-emails': sendEmails ? 'true' : 'false'
                }
            });

            if (error) throw error;


            let parsedData = data;
            if (typeof data === 'string') {
                try {
                    parsedData = JSON.parse(data);
                } catch (e) {
                    console.error("Failed to parse response data:", e);
                }
            }

            // Transform data to match UI expectations
            const rawStats = parsedData.stats || {};
            const matches = parsedData.matches || [];
            const candidates = parsedData.candidates || matches;

            const aggregatedStats = {
                processed_count: 0,
                failures: {} as Record<string, number>,
                ruleStats: {
                    dealbreakers: {} as Record<string, any>,
                    modifiers: {} as Record<string, any>
                }
            };

            Object.entries(rawStats).forEach(([algo, s]: any) => {
                aggregatedStats.processed_count += s.processed_count || 0;

                // Merge failures
                Object.entries(s.failures || {}).forEach(([k, v]: any) => {
                    aggregatedStats.failures[k] = (aggregatedStats.failures[k] || 0) + v;
                });

                // Merge dealbreakers
                Object.entries(s.ruleStats?.dealbreakers || {}).forEach(([k, v]: any) => {
                    const key = `${k} (${algo})`;
                    // Handle both old format (number) and new format (object)
                    const currentStats = aggregatedStats.ruleStats.dealbreakers[key] || { pass: 0, fail: 0 };

                    if (typeof v === 'number') {
                        currentStats.fail += v;
                    } else {
                        currentStats.pass += v.pass || 0;
                        currentStats.fail += v.fail || 0;
                    }
                    aggregatedStats.ruleStats.dealbreakers[key] = currentStats;
                });

                // Merge modifiers
                Object.entries(s.ruleStats?.modifiers || {}).forEach(([k, v]: any) => {
                    const key = `${k} (${algo})`;
                    if (!aggregatedStats.ruleStats.modifiers[key]) {
                        aggregatedStats.ruleStats.modifiers[key] = { ...v };
                    } else {
                        const existing = aggregatedStats.ruleStats.modifiers[key];
                        existing.totalScore += v.totalScore;
                        existing.count += v.count;
                        existing.min = Math.min(existing.min, v.min);
                        existing.max = Math.max(existing.max, v.max);
                    }
                });
            });

            const processedResults = {
                usersProcessed: aggregatedStats.processed_count, // Actual number of pairs checked for debug user
                pairsFound: matches.length,
                totalMatchesWouldCreate: matches.length,
                debugStats: aggregatedStats,
                matches: matches,
                candidates: candidates
            };

            setResults(processedResults);

            toast({
                title: isDryRun ? "Dry Run Complete" : "Matching Complete",
                description: `Found ${matches.length} matches.`,
            });
        } catch (error: any) {
            console.error("Matching error:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to run matching",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const forceWeeklyDropNow = async () => {
        setIsForcingWeeklyDrop(true);
        setWeeklyDropResult(null);
        try {
            const { data, error } = await supabase.functions.invoke('daily-cron', {
                body: { force_weekly_drop: true },
                headers: {
                    'dry-run': 'false'
                }
            });

            if (error) throw error;

            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            setWeeklyDropResult(parsedData);

            toast({
                title: "Weekly drop forced",
                description: parsedData?.message || "Forced weekly match drop completed.",
            });
        } catch (error: any) {
            console.error("Force weekly drop error:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to force weekly drop",
                variant: "destructive"
            });
        } finally {
            setIsForcingWeeklyDrop(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-4 bg-muted p-4 rounded-lg border">
                <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Debug User ID (Optional)</label>
                    <Input
                        placeholder="b7fcb0f9-41c0-4c5d-87df-2fd08d539a91"
                        value={debugUserId}
                        onChange={(e) => setDebugUserId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">b7fcb0f9-41c0-4c5d-87df-2fd08d539a91<br />9f4e3b19-a9e9-4030-94b2-ea92c030675a</p>
                </div>

                <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Algorithm</label>
                    <Select value={algorithm} onValueChange={setAlgorithm}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select algorithm" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Algorithms</SelectItem>
                            <SelectItem value="relationship">Relationship Daily</SelectItem>
                            <SelectItem value="friendship">Friendship Daily</SelectItem>
                            <SelectItem value="event">Event (Friendship & Relationship)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex-1 flex flex-col justify-end pb-2 space-y-2">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="send-emails"
                            checked={sendEmails}
                            onCheckedChange={setSendEmails}
                        />
                        <Label htmlFor="send-emails">Send Emails</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">If enabled, users will receive match emails.</p>
                </div>

                <div className="flex flex-col gap-2">
                    <Button
                        onClick={() => runMatching(true)}
                        disabled={isLoading}
                        className="min-w-[150px]"
                        variant="secondary"
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Run Dry Run
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                disabled={isLoading}
                                className="min-w-[150px]"
                                variant="destructive"
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                Run Real Match
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will run the matching algorithm for REAL.
                                    It will DELETE existing matches for the selected algorithm and create NEW matches.
                                    Emails may be sent to users.
                                    This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => runMatching(false)}>
                                    Yes, Run Matching
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <Switch
                    id="debug-filter"
                    checked={onlyShowDebugMatches}
                    onCheckedChange={setOnlyShowDebugMatches}
                />
                <Label htmlFor="debug-filter">Only show matches involving Debug User</Label>
            </div>

            <Card className="border-orange-300/60">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Weekly Drop Override
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Admin-only override. Runs real relationship matching now, even outside Monday 08:00 UTC window.
                        This replaces current matches and can send emails.
                    </p>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                disabled={isLoading || isForcingWeeklyDrop}
                                variant="destructive"
                            >
                                {isForcingWeeklyDrop ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                Force Weekly Drop Now
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Force weekly drop now?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will run real matching immediately, outside schedule, delete existing matches, create new ones, and may send emails.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={forceWeeklyDropNow}>
                                    Yes, Force Drop
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    {weeklyDropResult && (
                        <div className="text-xs text-muted-foreground rounded-md bg-muted p-3 border">
                            {weeklyDropResult.message || "Override completed."}
                        </div>
                    )}
                </CardContent>
            </Card>

            {results && (
                <div className="grid md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">Overview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <dt className="text-muted-foreground">Users Processed</dt>
                                    <dd className="font-mono text-xl">{results.usersProcessed}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Pairs Found</dt>
                                    <dd className="font-mono text-xl">{results.pairsFound}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Matches Created</dt>
                                    <dd className="font-mono text-xl">{results.totalMatchesWouldCreate || 0}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    {results.debugStats && (
                        <Card className="border-orange-200 bg-orange-50/10 col-span-1 md:col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Bug className="h-4 w-4 text-orange-500" />
                                    Debug Stats for User
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div>
                                            <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Process Count</div>
                                            <div className="font-mono">{results.debugStats.processed_count} pairs evaluated</div>
                                        </div>

                                        <div>
                                            <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Failures Overview</div>
                                            <ScrollArea className="h-[200px] w-full rounded-md border p-2">
                                                <div className="text-xs space-y-1">
                                                    {Object.entries(results.debugStats.failures || {}).sort(([, a]: any, [, b]: any) => b - a).map(([reason, count]: any) => (
                                                        <div key={reason} className="flex justify-between">
                                                            <span className="break-all mr-2">{reason}</span>
                                                            <Badge variant="secondary">{count}</Badge>
                                                        </div>
                                                    ))}
                                                    {Object.keys(results.debugStats.failures || {}).length === 0 && (
                                                        <span className="text-green-600">No failures recorded</span>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </div>

                                    {results.debugStats.ruleStats && (
                                        <div className="space-y-4">
                                            <div>
                                                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Dealbreaker Rules (Top Rejections)</div>
                                                <ScrollArea className="h-[120px] w-full rounded-md border p-2">
                                                    <div className="text-xs space-y-1">
                                                        {Object.entries(results.debugStats.ruleStats.dealbreakers || {})
                                                            .sort(([, a]: any, [, b]: any) => b.fail - a.fail)
                                                            .map(([rule, stats]: any) => (
                                                                <div key={rule} className="flex justify-between items-center">
                                                                    <span className="font-medium truncate flex-1">{rule}</span>
                                                                    <div className="flex gap-2 text-xs font-mono ml-2">
                                                                        <span className="text-green-600">Pass: {stats.pass}</span>
                                                                        <span className="text-red-500">Fail: {stats.fail}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        {Object.keys(results.debugStats.ruleStats.dealbreakers || {}).length === 0 && (
                                                            <span className="text-muted-foreground italic">No dealbreakers triggered</span>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>

                                            <div>
                                                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Modifier Impact (Avg Score)</div>
                                                <ScrollArea className="h-[120px] w-full rounded-md border p-2">
                                                    <div className="text-xs space-y-1">
                                                        {Object.entries(results.debugStats.ruleStats.modifiers || {})
                                                            .map(([rule, stats]: any) => ({
                                                                rule,
                                                                avg: stats.totalScore / stats.count,
                                                                ...stats
                                                            }))
                                                            .sort((a: any, b: any) => b.avg - a.avg)
                                                            .map((item: any) => (
                                                                <div key={item.rule} className="flex justify-between items-center">
                                                                    <span className="font-medium truncate flex-1" title={`Min: ${item.min.toFixed(0)}, Max: ${item.max.toFixed(0)}`}>{item.rule}</span>
                                                                    <span className={`font-mono ml-2 ${item.avg > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                                                                        +{item.avg.toFixed(1)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        {Object.keys(results.debugStats.ruleStats.modifiers || {}).length === 0 && (
                                                            <span className="text-muted-foreground italic">No modifiers applied</span>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Match Candidates</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px]">
                                <Accordion type="single" collapsible>
                                    {results.candidates
                                        ?.filter((match: any) => {
                                            if (!onlyShowDebugMatches) return true;
                                            if (!debugUserId) return true;
                                            return match.user1_id === debugUserId || match.user2_id === debugUserId;
                                        })
                                        .map((match: any, i: number) => (
                                            <AccordionItem key={i} value={`item-${i}`}>
                                                <AccordionTrigger className="hover:no-underline">
                                                    <div className="flex items-center gap-4 w-full pr-4">
                                                        <div className="flex items-center gap-2 flex-1 text-left">
                                                            <Badge variant={match.compatibility_score > 80 ? "default" : "secondary"}>
                                                                {match.compatibility_score}%
                                                            </Badge>
                                                            <span className="font-semibold">{match.user1_name}</span>
                                                            <span className="text-muted-foreground text-xs">&</span>
                                                            <span className="font-semibold">{match.user2_name}</span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground hidden sm:block">
                                                            Prev Matches: {match.times_user1_matched_user2}
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="grid grid-cols-2 gap-4 text-xs p-2 bg-muted/20 rounded-md">
                                                        <div>
                                                            <strong>User 1 ({match.user1_name}):</strong>
                                                            <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                                                <li>Gender: {match.user1_gender}</li>
                                                                <li>Options avail: {match.user1_options}</li>
                                                                <li>Min prev matches: {match.user1_min}</li>
                                                                <li>Liked match? {match.user1_liked_user2 ? 'Yes' : 'No'}</li>
                                                            </ul>
                                                        </div>
                                                        <div>
                                                            <strong>User 2 ({match.user2_name}):</strong>
                                                            <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                                                <li>Gender: {match.user2_gender}</li>
                                                                <li>Options avail: {match.user2_options}</li>
                                                                <li>Min prev matches: {match.user2_min}</li>
                                                                <li>Liked match? {match.user2_liked_user1 ? 'Yes' : 'No'}</li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                </Accordion>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};
