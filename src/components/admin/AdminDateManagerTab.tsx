import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

import { useAdminDates } from "@/hooks/admin/useAdminDates";
import { useAdminMutualLikes } from "@/hooks/admin/useAdminMutualLikes";

interface AdminDateManagerTabProps {
    onViewDateAsUser: (dateId: string, userId: string) => void;
    onEmailDate: (date: any) => void;
}

export const AdminDateManagerTab = ({ onViewDateAsUser, onEmailDate }: AdminDateManagerTabProps) => {
    const { toast } = useToast();
    const [isCreatingDate, setIsCreatingDate] = useState(false);
    const [dateTypeFilter, setDateTypeFilter] = useState<"all" | "relationship" | "friendship">("all");
    const [statusView, setStatusView] = useState<"all" | "completed" | "cancelled" | "auto_cancelled">("completed");
    const { historicalMutualLikes, refreshMutualLikes, loading: likesLoading } = useAdminMutualLikes();
    const { dates, dateMap, refreshDates, completedDatesCount, totalDatesCount, loading: datesLoading } = useAdminDates();

    const onDateChange = () => {
        refreshDates();
        refreshMutualLikes();
    };

    const getStatusLabel = (status?: string) => {
        if (!status) return "unknown";
        if (status === "confirmed") return "scheduled";
        return status.replaceAll("_", " ");
    };

    const getStatusBadgeClass = (status?: string) => {
        switch (status) {
            case "confirmed":
                return "bg-green-100 text-green-800";
            case "pending":
            case "limbo":
                return "bg-yellow-100 text-yellow-800";
            case "cancelled":
            case "auto_cancelled":
                return "bg-red-100 text-red-800";
            case "completed":
                return "bg-blue-100 text-blue-800";
            default:
                return "bg-gray-100 text-gray-500";
        }
    };

    const hasUserCancellationReason = (date: any) => {
        return !!((date.user1_feedback || date.user2_feedback || "").trim());
    };

    const isAutoCancelledDate = (date: any) =>
        date.status === "auto_cancelled" || (date.status === "cancelled" && !hasUserCancellationReason(date));

    const isUserCancelledDate = (date: any) =>
        date.status === "cancelled" && hasUserCancellationReason(date);

    const getAutoCancelReason = (date: any) => {
        const saved = (date.user1_feedback || date.user2_feedback || "").trim();
        if (saved) return saved;
        return "Auto cancelled: Expired pending date window (>10 days from first possible day)";
    };

    const getDisplayedStatusLabel = (date: any) => {
        if (isAutoCancelledDate(date)) return "auto cancelled";
        if (isUserCancelledDate(date)) return "cancelled";
        return getStatusLabel(date.status);
    };

    const allDatesSorted = [...dates]
        .sort((a, b) => {
            const aDate = new Date(a.date_time || a.first_possible_day || a.created_at || 0).getTime();
            const bDate = new Date(b.date_time || b.first_possible_day || b.created_at || 0).getTime();
            return bDate - aDate;
        });

    const filteredDates = useMemo(() => {
        return allDatesSorted.filter((date) => {
            const statusMatches =
                statusView === "all"
                    ? true
                    : statusView === "auto_cancelled"
                        ? isAutoCancelledDate(date)
                        : statusView === "cancelled"
                            ? isUserCancelledDate(date)
                            : date.status === statusView;
            const typeMatches = dateTypeFilter === "all" ? true : (date.match_type || "relationship") === dateTypeFilter;
            return statusMatches && typeMatches;
        });
    }, [allDatesSorted, statusView, dateTypeFilter]);

    const statusCounts = filteredDates.reduce<Record<string, number>>((acc, date) => {
        const label = getDisplayedStatusLabel(date);
        acc[label] = (acc[label] || 0) + 1;
        return acc;
    }, {});

    const mutualLikeByPair = useMemo(() => {
        const map = new Map<string, any>();
        for (const pair of historicalMutualLikes) {
            const key = [pair.user_id, pair.matched_user_id].sort().join("-");
            map.set(key, pair);
        }
        return map;
    }, [historicalMutualLikes]);

    const formatFollowup = (value?: string | null) => {
        if (!value) return "No feedback yet";
        if (value === "match") return "Match again";
        if (value === "friend") return "Be friends";
        if (value === "pass") return "Pass";
        return value;
    };

    const summarizeOutcome = (date: any) => {
        if (isAutoCancelledDate(date)) return "Auto cancelled";
        if (isUserCancelledDate(date)) return "Cancelled by user";
        const p1 = date.user1_followup_preference;
        const p2 = date.user2_followup_preference;
        if (!p1 && !p2) return "Pending both feedbacks";
        if (p1 === "match" && p2 === "match") return "Mutual match";
        if (p1 === "friend" && p2 === "friend") return "Mutual friendship";
        if (p1 === "pass" || p2 === "pass") return "One-sided pass";
        if (!p1 || !p2) return "Waiting for one side";
        return "Mixed preferences";
    };

    const mutualLikeVisiblePairs = historicalMutualLikes.filter((pair: any) => {
        const key = [pair.user_id, pair.matched_user_id].sort().join("-");
        const existingDate = dateMap.get(key);
        if (!existingDate) return true; // no date yet
        return existingDate.status === "confirmed"; // scheduled only
    });

    const sortedAllMutualPairs = [...mutualLikeVisiblePairs].sort((a, b) => {
        const keyA = [a.user_id, a.matched_user_id].sort().join("-");
        const keyB = [b.user_id, b.matched_user_id].sort().join("-");
        const dateA = dateMap.get(keyA);
        const dateB = dateMap.get(keyB);
        const timeA = dateA?.date_time || dateA?.first_possible_day || a.created_at;
        const timeB = dateB?.date_time || dateB?.first_possible_day || b.created_at;
        return new Date(timeB || 0).getTime() - new Date(timeA || 0).getTime();
    });

    const cancelledDates = dates.filter((d: any) => d.status === "cancelled" || d.status === "auto_cancelled");
    const userCancelledDates = cancelledDates.filter((d: any) => isUserCancelledDate(d));
    const autoCancelledDates = cancelledDates.filter((d: any) => isAutoCancelledDate(d));
    const cancellationReasonCounts = cancelledDates.reduce<Record<string, number>>((acc, d: any) => {
        const reason = isAutoCancelledDate(d)
            ? getAutoCancelReason(d)
            : ((d.user1_feedback || d.user2_feedback || "No reason provided").trim());
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
    }, {});

    const handleAdminCreateDate = async (match: any) => {
        setIsCreatingDate(true);
        try {
            const { data, error } = await supabase.functions.invoke("check-match-and-create-date", {
                body: {
                    userId: match.user_id,
                    matchedUserId: match.matched_user_id,
                    email_both: true,
                },
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast({
                title: "Success",
                description: "Date created and emails sent.",
            });
            onDateChange();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to create date",
                variant: "destructive",
            });
        } finally {
            setIsCreatingDate(false);
        }
    };

    if (datesLoading || likesLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading date manager...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Dates</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalDatesCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Completed Dates</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{completedDatesCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Filtered Dates</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredDates.length}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Dates ({filteredDates.length})</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Completed dates with full details, mutual-like history, and outcome.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant={statusView === "all" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusView("all")}
                        >
                            All Statuses
                        </Button>
                        <Button
                            variant={statusView === "completed" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusView("completed")}
                        >
                            Completed Only
                        </Button>
                        <Button
                            variant={statusView === "cancelled" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusView("cancelled")}
                        >
                            Cancelled
                        </Button>
                        <Button
                            variant={statusView === "auto_cancelled" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusView("auto_cancelled")}
                        >
                            Auto Cancelled
                        </Button>
                        <Button
                            variant={dateTypeFilter === "all" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDateTypeFilter("all")}
                        >
                            Romantic + Friendship
                        </Button>
                        <Button
                            variant={dateTypeFilter === "relationship" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDateTypeFilter("relationship")}
                        >
                            Romantic
                        </Button>
                        <Button
                            variant={dateTypeFilter === "friendship" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDateTypeFilter("friendship")}
                        >
                            Friendship
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                        {Object.entries(statusCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([status, count]) => (
                                <span key={status} className="px-2 py-1 rounded bg-muted">
                                    {status.toUpperCase()}: {count}
                                </span>
                            ))}
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>When</TableHead>
                                <TableHead>Where</TableHead>
                                <TableHead>Users</TableHead>
                                <TableHead>Mutual Likes</TableHead>
                                <TableHead>Outcome</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredDates.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                                        No dates found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredDates.map((date) => {
                                    const pairKey = [date.user1_id, date.user2_id].sort().join("-");
                                    const mutualLike = mutualLikeByPair.get(pairKey);
                                    const user1Name = `${date.user1_profile?.first_name || "Unknown"} ${date.user1_profile?.last_name || ""}`.trim();
                                    const user2Name = `${date.user2_profile?.first_name || "Unknown"} ${date.user2_profile?.last_name || ""}`.trim();
                                    const when = date.date_time || date.first_possible_day;
                                    const cancellationReason = (date.user1_feedback || date.user2_feedback || "No reason provided").trim();
                                    const isCancelled = isUserCancelledDate(date);
                                    const isAutoCancelled = isAutoCancelledDate(date);

                                    return (
                                        <TableRow key={date.id}>
                                            <TableCell className="text-sm">
                                                <div>{when ? format(new Date(when), "MMM d, yyyy h:mm a") : "Unknown"}</div>
                                                {date.timezone && <div className="text-xs text-muted-foreground">{date.timezone}</div>}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div>{date.location || date.address || "No location"}</div>
                                                {date.activity && <div className="text-xs text-muted-foreground">{date.activity}</div>}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <div>{user1Name}</div>
                                                <div className="text-muted-foreground">{user2Name}</div>
                                                <div className="flex gap-2 mt-1">
                                                    <Button size="sm" variant="outline" onClick={() => onViewDateAsUser(date.id, date.user1_id)}>View as {date.user1_profile?.first_name || "User 1"}</Button>
                                                    <Button size="sm" variant="outline" onClick={() => onViewDateAsUser(date.id, date.user2_id)}>View as {date.user2_profile?.first_name || "User 2"}</Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {mutualLike ? (
                                                    <>
                                                        <div>U1 liked: {mutualLike.user1_like_date ? format(new Date(mutualLike.user1_like_date), "MMM d, yyyy") : "Unknown"}</div>
                                                        <div>U2 liked: {mutualLike.user2_like_date ? format(new Date(mutualLike.user2_like_date), "MMM d, yyyy") : "Unknown"}</div>
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground">Not found</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {isCancelled ? (
                                                    <>
                                                        <div className="font-medium">Cancelled by user</div>
                                                        <div className="text-xs text-muted-foreground truncate" title={cancellationReason}>
                                                            Reason: {cancellationReason}
                                                        </div>
                                                    </>
                                                ) : isAutoCancelled ? (
                                                    <>
                                                        <div className="font-medium">Auto cancelled</div>
                                                        <div className="text-xs text-muted-foreground truncate" title={getAutoCancelReason(date)}>
                                                            Reason: {getAutoCancelReason(date)}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="font-medium">{summarizeOutcome(date)}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {date.user1_profile?.first_name || "User 1"}: {formatFollowup(date.user1_followup_preference)}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {date.user2_profile?.first_name || "User 2"}: {formatFollowup(date.user2_followup_preference)}
                                                        </div>
                                                    </>
                                                )}
                                            </TableCell>
                                            <TableCell className="uppercase text-xs font-semibold">
                                                {(date.match_type || "relationship") === "friendship" ? "FRIENDSHIP" : "ROMANTIC"}
                                            </TableCell>
                                            <TableCell className="uppercase text-xs font-semibold">{getDisplayedStatusLabel(date)}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                <div>{date.id}</div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="px-0 h-6"
                                                    onClick={() => onEmailDate(date)}
                                                >
                                                    Email both
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Cancelled Breakdown</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        User-cancelled means one side provided a cancellation reason. Auto/system means no user reason was saved.
                    </p>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Card className="border-border/60">
                            <CardContent className="p-3">
                                <p className="text-xs text-muted-foreground">Total Cancelled</p>
                                <p className="text-xl font-semibold">{cancelledDates.length}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/60">
                            <CardContent className="p-3">
                                <p className="text-xs text-muted-foreground">Cancelled By User</p>
                                <p className="text-xl font-semibold">{userCancelledDates.length}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/60">
                            <CardContent className="p-3">
                                <p className="text-xs text-muted-foreground">Auto / System Cancelled</p>
                                <p className="text-xl font-semibold">{autoCancelledDates.length}</p>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="space-y-2">
                        {Object.entries(cancellationReasonCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 8)
                            .map(([reason, count]) => (
                                <div key={reason} className="flex justify-between gap-2 text-sm border rounded px-2 py-1">
                                    <span className="truncate">{reason}</span>
                                    <span className="font-semibold">{count}</span>
                                </div>
                            ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Mutual-Like Pairs (No Date Yet + Scheduled) ({sortedAllMutualPairs.length})</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Shows only pairs with no date yet, or with a scheduled date.
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sortedAllMutualPairs.map((match: any) => {
                            const pairKey = [match.user_id, match.matched_user_id].sort().join("-");
                            const existingDate = dateMap.get(pairKey);
                            const usersInPair = [
                                { id: match.user_id, profile: match.user_profile, likeDate: match.user1_like_date },
                                { id: match.matched_user_id, profile: match.matched_user_profile, likeDate: match.user2_like_date },
                            ].sort((u1, u2) =>
                                (u1.profile?.first_name || "").localeCompare(u2.profile?.first_name || "", undefined, { sensitivity: "base" })
                            );

                            return (
                                <Card key={match.id} className="overflow-hidden">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-center">
                                            <div className="text-sm font-bold text-primary">Mutual Like</div>
                                            {existingDate ? (
                                                <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${getStatusBadgeClass(existingDate.status)}`}>
                                                    {getStatusLabel(existingDate.status)}
                                                </div>
                                            ) : (
                                                <div className="px-2 py-1 rounded text-xs font-bold uppercase bg-gray-100 text-gray-500">
                                                    No Date Yet
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {usersInPair.map((u) => (
                                            <div key={u.id} className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <img src={u.profile?.photo_url || "/placeholder.svg"} className="w-8 h-8 rounded-full object-cover" />
                                                    <span className="text-sm font-medium">{u.profile?.first_name}</span>
                                                    <span className="text-xs text-muted-foreground">{u.profile?.id}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Liked: {u.likeDate ? format(new Date(u.likeDate), "MMM d, yyyy") : "Unknown"}
                                                </div>
                                            </div>
                                        ))}
                                        {existingDate && (
                                            <div className="text-xs space-y-1 bg-muted/50 p-2 rounded">
                                                <div className="font-semibold">Date Details:</div>
                                                <div>
                                                    {(existingDate.date_time || existingDate.first_possible_day)
                                                        ? format(new Date(existingDate.date_time || existingDate.first_possible_day), "MMM d, yyyy h:mm a")
                                                        : "Pending date time"}
                                                </div>
                                                <div className="text-muted-foreground">{existingDate.location || existingDate.address || "No location yet"}</div>
                                                <div className="text-muted-foreground">
                                                    Outcome: {summarizeOutcome(existingDate)}
                                                </div>
                                                <div className="flex gap-2 pt-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 text-xs flex-1"
                                                        onClick={() => onViewDateAsUser(existingDate.id, usersInPair[0].id)}
                                                    >
                                                        View as {usersInPair[0].profile?.first_name || "User 1"}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 text-xs flex-1"
                                                        onClick={() => onViewDateAsUser(existingDate.id, usersInPair[1].id)}
                                                    >
                                                        View as {usersInPair[1].profile?.first_name || "User 2"}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        <Button
                                            onClick={() => existingDate ? onEmailDate(existingDate) : handleAdminCreateDate(match)}
                                            disabled={isCreatingDate}
                                            size="sm"
                                            className="w-full"
                                        >
                                            {existingDate ? "Email Both" : "Create Date & Email Both"}
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
