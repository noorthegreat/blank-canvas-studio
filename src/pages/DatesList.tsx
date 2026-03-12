import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hammer, CalendarOff, Sparkles, Calendar, ArrowRight, MapPin, CalendarCheck, Building2, AlertTriangle, Trash2, Phone } from "lucide-react";
import { AvailabilityPlanner, Availability, Venue, calculateLargestOverlap } from "@/components/AvailabilityPlanner";
import { LongPressButton } from "@/components/ui/long-press-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/Navigation";
import Footer from "./Footer";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { canAccessDating } from "@/lib/dating-eligibility";
import StudentEmailVerificationCard from "@/components/StudentEmailVerificationCard";
import { syncProfileEmailFromAuth } from "@/lib/profile-email";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DateFeedbackDialog } from "@/components/DateFeedbackDialog";

type DateType = {
    id: string;
    date_time: string | null;
    location: string | null;
    first_possible_day: string | null;
    user1_id: string;
    user2_id: string;
    user1_confirmed: boolean;
    user2_confirmed: boolean;
    status: "pending" | "confirmed" | "limbo" | "completed" | "cancelled" | "auto_cancelled";
    user1_feedback: string | null;
    user2_feedback: string | null;
    user1_followup_preference: "match" | "friend" | "pass" | null;
    user2_followup_preference: "match" | "friend" | "pass" | null;
    matched_user: {
        id: string;
        first_name: string;
        additional_photos: string[] | null;
    };
    venue_options?: string[] | null;
    address: string | null;
    hasMyAvailability?: boolean;
    hasOverlap?: boolean;
    user1_share_phone: boolean;
    user2_share_phone: boolean;
    timezone?: string | null;
};

const ConfirmationBadge = ({ isConfirmed, label }: { isConfirmed: boolean; label: string }) => (
    <div className={cn(
        "flex items-center gap-2 px-3 py-1 rounded-sm text-sm font-medium",
        isConfirmed ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
    )}>
        {isConfirmed ? <CalendarCheck className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-current" />}
        <span>{label}: {isConfirmed ? "Confirmed" : "Pending"}</span>
    </div>
);

const PhoneBadge = ({ isShared, label }: { isShared: boolean; label: string }) => (
    <div className={cn(
        "mt-2 flex items-center gap-2 px-3 py-1 rounded-sm text-sm font-medium border border-border/50",
        isShared ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-muted text-muted-foreground opacity-70"
    )}>
        <Phone className="w-3 h-3" />
        <span className="text-xs">{label}: {isShared ? "Shared" : "Hidden"}</span>
    </div>
);

const DateList = ({ dates, emptyMessage, emptyDescription, navigate, userId, isCancelled = false, isAdmin = false, onDelete, onMarkCompleted }: { dates: DateType[], emptyMessage: string, emptyDescription: string, navigate: any, userId: string | null, isCancelled?: boolean, isAdmin?: boolean, onDelete?: (date: DateType) => void, onMarkCompleted?: (date: DateType) => void }) => {
    const [feedbackDate, setFeedbackDate] = useState<DateType | null>(null);
    const { toast } = useToast();



    if (dates.length === 0) {
        return (
            <Card className="text-center p-12 shadow-xl border-border/50">
                <CalendarOff className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <CardTitle className="mb-2">{emptyMessage}</CardTitle>
                <CardDescription>
                    {emptyDescription}
                </CardDescription>
            </Card>
        );
    }

    return (
        <div className="grid gap-6">
            {dates.map((date) => (
                <Card
                    key={date.id}
                    className={cn(
                        "shadow-lg border-border/50 transition-transform",
                        !isCancelled && "cursor-pointer hover:scale-[1.01]"
                    )}
                    onClick={() => !isCancelled && navigate(`/dates/${date.id}`)}
                >
                    <CardContent className="relative">
                        {isAdmin && onDelete && (
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 z-50 h-8 w-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(date);
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}

                        {isCancelled ? (
                            <>
                                <span className="text-2xl font-semibold tracking-tight">Date with {date.matched_user.first_name}</span>
                                {isCancelled && <span className="text-sm font-normal px-2 py-1 bg-destructive/10 text-destructive rounded-full border border-destructive/20 ml-2">Cancelled</span>}

                                <div className="bg-muted/50 p-4 rounded-lg space-y-2 mt-4">
                                    <div className="flex items-center gap-2 text-destructive font-medium">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span>Cancellation Reason:</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground italic">
                                        "{date.user1_feedback || date.user2_feedback || "No reason provided"}"
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="p-6 flex md:flex-row flex-col justify-between gap-6 md:gap-10">
                                <div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-2xl font-semibold tracking-tight">Date with {date.matched_user.first_name}</span>
                                    </div>

                                    <div className="my-2 md:w-80 flex flex-col gap-2">
                                        {date.date_time ? (
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4" />
                                                <span>{format(new Date(date.date_time), "EEEE, MMMM d, yyyy 'at' h:mm a")}</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col p-2 gap-2 rounded-sm text-sm font-medium bg-muted text-muted-foreground">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>Date time & location pending.</span>
                                                </div>
                                                {date.first_possible_day && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-4" />
                                                        <span className="text-sm font-bold">
                                                            Sometime between {format(new Date(date.first_possible_day + 'T00:00:00'), "MMM d")} and {format(addDays(new Date(date.first_possible_day + 'T00:00:00'), 6), "MMM d")}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {date.location && (
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4" />
                                                <span>{date.location}</span>
                                            </div>
                                        )}
                                        {date.address && (
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4" />
                                                <span>{date.address}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 justify-center">
                                        <div>
                                            <ConfirmationBadge
                                                isConfirmed={date.user1_id === userId ? date.user1_confirmed : date.user2_confirmed}
                                                label="You"
                                            />
                                            <PhoneBadge
                                                isShared={date.user1_id === userId ? date.user1_share_phone : date.user2_share_phone}
                                                label="You"
                                            />
                                        </div>
                                        <div>
                                            <ConfirmationBadge
                                                isConfirmed={date.user1_id === userId ? date.user2_confirmed : date.user1_confirmed}
                                                label={date.matched_user.first_name}
                                            />
                                            <PhoneBadge
                                                isShared={date.user1_id === userId ? date.user2_share_phone : date.user1_share_phone}
                                                label={date.matched_user.first_name}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col justify-between">
                                    {(date.status === "confirmed") && (
                                        <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 p-3 rounded-lg text-sm flex items-start gap-2 max-w-sm">
                                            <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                                            <span>Awesome, your date is confirmed! We'll email you reminders a day before and an hour before your date starts :)
                                                <br /><br /> If you can't make the date for any reason, please reschedule or cancel beforehand. Ghosters will be banned from the app lol
                                            </span>
                                        </div>
                                    )}
                                    {(date.status === "pending") && (
                                        <div className="bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 p-3 rounded-lg text-sm flex items-start gap-2 max-w-sm">
                                            <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                                            <div className="flex flex-col gap-2">
                                                <span>Your date is created, now it's time to add your availability! Click this date card to do so.<br />
                                                    <br />Once you've both added your availability, you'll both be able to confirm the date :)
                                                </span>
                                                {!isCancelled && (
                                                    (!date.hasMyAvailability || (date.hasOverlap && !(date.user1_id === userId ? date.user1_confirmed : date.user2_confirmed))) && (
                                                        <div className="flex justify-end">
                                                            <div className="flex items-center gap-2 text-center text-xs font-bold p-2 px-4 bg-linear-to-r from-backgrounda to-backgroundc  text-white rounded-full">
                                                                View Details to {date.hasMyAvailability ? "Confirm" : "Add Availability"} <ArrowRight className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {!isCancelled && date.status !== "completed" && date.date_time && new Date() > new Date(date.date_time) && (
                                        <div className="mt-4 flex justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onMarkCompleted) onMarkCompleted(date);
                                                }}
                                                className="gap-2"
                                            >
                                                <CalendarCheck className="w-4 h-4" />
                                                Mark as completed
                                            </Button>
                                        </div>
                                    )}

                                    {date.status === "completed" && (
                                        <div className="mt-4">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="w-full"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFeedbackDate(date);
                                                }}
                                            >
                                                <Sparkles className="w-4 h-4 mr-2" />
                                                Give Date Feedback
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
            <DateFeedbackDialog
                date={feedbackDate as any}
                isOpen={!!feedbackDate}
                onClose={() => setFeedbackDate(null)}
                currentUserId={userId}
            />
        </div>
    );
};

const DatesList = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [dates, setDates] = useState<DateType[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("upcoming");
    const [canDate, setCanDate] = useState(true);
    const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

    const getPendingFeedbackCount = async (currentUserId: string): Promise<number> => {
        const { data: completedDates, error: datesError } = await supabase
            .from("dates")
            .select("id, user1_id, user2_id, user1_followup_preference, user2_followup_preference")
            .eq("status", "completed")
            .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

        if (datesError) throw datesError;
        if (!completedDates || completedDates.length === 0) return 0;

        const completedDateIds = completedDates.map((d) => d.id);

        // @ts-ignore - Generated types can lag behind migrations in some environments
        const { data: answers, error: answersError } = await (supabase as any)
            .from("date_feedback_answers")
            .select("date_id")
            .eq("user_id", currentUserId)
            .in("date_id", completedDateIds);

        if (answersError) throw answersError;

        const answeredDateIds = new Set<string>((answers || []).map((a: { date_id: string }) => a.date_id));

        let pendingCount = 0;
        for (const date of completedDates) {
            const isUser1 = date.user1_id === currentUserId;
            const followupSet = isUser1 ? !!date.user1_followup_preference : !!date.user2_followup_preference;
            const hasAnswers = answeredDateIds.has(date.id);
            if (!followupSet || !hasAnswers) {
                pendingCount += 1;
            }
        }

        return pendingCount;
    };

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) {
                navigate("/auth");
                return;
            }
            setUserId(session.user.id);
            setUserEmail(session.user.email ?? null);
            await syncProfileEmailFromAuth(session.user.id, session.user.email);
            const userCanDate = canAccessDating(session.user);
            setCanDate(userCanDate);
            setPendingFeedbackCount(0);

            const { data: hasAdminRole } = await supabase.rpc('has_role', {
                _user_id: session.user.id,
                _role: 'admin'
            });
            setIsAdmin(!!hasAdminRole);

            if (userCanDate || hasAdminRole) {
                await loadDates(session.user.id);
                try {
                    const pending = await getPendingFeedbackCount(session.user.id);
                    setPendingFeedbackCount(pending);
                } catch (error) {
                    console.error("Error checking feedback completion gate:", error);
                }
            } else {
                setDates([]);
            }
            setIsLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (!session) {
                navigate("/auth");
                return;
            }
            void (async () => {
                setUserId(session.user.id);
                setUserEmail(session.user.email ?? null);
                await syncProfileEmailFromAuth(session.user.id, session.user.email);
                const userCanDate = canAccessDating(session.user);
                setCanDate(userCanDate);
                setPendingFeedbackCount(0);

                const { data: hasAdminRole } = await supabase.rpc('has_role', {
                    _user_id: session.user.id,
                    _role: 'admin'
                });
                setIsAdmin(!!hasAdminRole);

                if (userCanDate || hasAdminRole) {
                    await loadDates(session.user.id);
                    try {
                        const pending = await getPendingFeedbackCount(session.user.id);
                        setPendingFeedbackCount(pending);
                    } catch (error) {
                        console.error("Error checking feedback completion gate:", error);
                    }
                } else {
                    setDates([]);
                }
            })();
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    const loadDates = async (currentUserId: string) => {
        try {
            // Fetch venues first (needed for overlap calculation)
            const { data: venuesData, error: venuesError } = await supabase
                .from("venues")
                .select("*");

            if (venuesError) throw venuesError;

            const venuesMap: Record<string, Venue> = {};
            venuesData?.forEach((v) => {
                venuesMap[v.type] = { ...v, hours: v.hours as any };
            });

            // Fetch dates
            const { data: datesData, error: datesError } = await supabase
                .from("dates")
                .select("*")
                .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
                .order("date_time", { ascending: true });

            if (datesError) throw datesError;

            if (!datesData || datesData.length === 0) {
                setDates([]);
                return;
            }

            // Get matched user profiles
            const matchedUserIds = datesData.map((d) =>
                d.user1_id === currentUserId ? d.user2_id : d.user1_id
            );

            const { data: profilesData, error: profilesError } = await supabase
                .from("profiles")
                .select("id, first_name, additional_photos")
                .in("id", matchedUserIds);

            if (profilesError) throw profilesError;

            // Combine data - availability is now on the dates table directly
            const combinedDates = datesData.map((date) => {
                const matchedUserId = date.user1_id === currentUserId ? date.user2_id : date.user1_id;
                const profile = profilesData?.find((p) => p.id === matchedUserId);

                // Calculate availability info from dates table columns
                const isUser1 = date.user1_id === currentUserId;
                const myAvail = (isUser1 ? date.user1_availability : date.user2_availability) as Availability || {};
                const partnerAvail = (isUser1 ? date.user2_availability : date.user1_availability) as Availability || {};

                const hasMyAvailability = Object.values(myAvail).some((slots: number[]) => slots && slots.length > 0);

                // Construct specific venues map if needed
                let currentVenuesMap = venuesMap;
                if (date.venue_options && date.venue_options.length > 0) {
                    currentVenuesMap = {};
                    date.venue_options.forEach((venueId: string) => {
                        // Find venue in global list
                        const venue = venuesData?.find((v) => v.id === venueId);
                        if (venue) {
                            currentVenuesMap[venue.type] = { ...venue, hours: venue.hours as any };
                        }
                    });
                }

                const overlap = calculateLargestOverlap(myAvail, partnerAvail, currentVenuesMap);

                return {
                    id: date.id,
                    date_time: date.date_time,
                    location: date.location,
                    first_possible_day: date.first_possible_day,
                    user1_id: date.user1_id,
                    user2_id: date.user2_id,
                    user1_confirmed: date.user1_confirmed,
                    user2_confirmed: date.user2_confirmed,
                    status: date.status,
                    user1_feedback: date.user1_feedback,
                    user2_feedback: date.user2_feedback,
                    user1_followup_preference: date.user1_followup_preference,
                    user2_followup_preference: date.user2_followup_preference,
                    address: date.address,
                    matched_user: profile || {
                        id: matchedUserId,
                        first_name: "Unknown User",
                        additional_photos: null,
                    },
                    hasMyAvailability,
                    hasOverlap: !!overlap,
                    user1_share_phone: date.user1_share_phone || false,
                    user2_share_phone: date.user2_share_phone || false,
                    timezone: date.timezone,
                };
            });

            setDates(combinedDates);

        } catch (error: any) {
            console.error("Error loading dates:", error);
            toast({
                title: "Error loading dates",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleDeleteDate = async (date: DateType) => {
        if (!confirm("Are you sure you want to delete this date? This cannot be undone.")) return;

        try {

            // Delete likes for both users so they don't match again immediately if they browse matches
            const { error: deleteLikesError } = await supabase
                .from("likes")
                .delete()
                .or(`and(user_id.eq.${date.user1_id},liked_user_id.eq.${date.user2_id}),and(user_id.eq.${date.user2_id},liked_user_id.eq.${date.user1_id})`);

            if (deleteLikesError) { console.error(deleteLikesError) }

            const { error } = await supabase.from("dates").delete().eq("id", date.id);

            if (error) throw error;
            console.log("Deleting date id ", date.id);
            toast({
                title: "Date deleted",
                description: "The date has been permanently removed.",
            });

            // Refresh list
            if (userId) loadDates(userId);
        } catch (error: any) {
            console.error("Error deleting date:", error);
            toast({
                title: "Error deleting date",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleMarkCompleted = async (date: DateType) => {
        try {
            const { error } = await supabase
                .from("dates")
                .update({ status: "completed" })
                .eq("id", date.id);

            if (error) throw error;

            toast({
                title: "Date marked as completed",
                description: "Hope you had a great time!",
            });

            // Update local state
            setDates(prev => prev.map(d => d.id === date.id ? { ...d, status: "completed" } : d));

            // Switch to completed tab
            setActiveTab("completed");

        } catch (error: any) {
            console.error("Error updating date:", error);
            toast({
                title: "Error",
                description: "Could not mark date as completed.",
                variant: "destructive",
            });
        }
    };

    if (isLoading) {
        return (
            <>
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="text-center space-y-4">
                        <Sparkles className="w-12 h-12 mx-auto text-white animate-pulse" />
                        <p className="text-white">Loading...</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="p-4 py-12">
                <div className="max-w-4xl mx-auto space-y-12">
                    {!canDate && !isAdmin && (
                        <StudentEmailVerificationCard currentEmail={userEmail} />
                    )}

                    {pendingFeedbackCount > 0 && (canDate || isAdmin) && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-400 p-4 rounded-md">
                            <div className="flex items-start gap-3">
                                <Sparkles className="h-5 w-5 text-indigo-400 mt-0.5 shrink-0" />
                                <p className="text-sm text-indigo-800 dark:text-indigo-200">
                                    Feedback required to unlock new weekly matches. You still need to submit feedback for{" "}
                                    <span className="font-semibold">{pendingFeedbackCount}</span> completed{" "}
                                    {pendingFeedbackCount === 1 ? "date" : "dates"}.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Upcoming Dates Section */}
                    {(canDate || isAdmin) && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h1 className="text-3xl font-bold text-white">Your Dates</h1>
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 mb-8">
                                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                                <TabsTrigger value="completed">Completed</TabsTrigger>
                                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
                            </TabsList>

                            <TabsContent value="upcoming" className="space-y-6">
                                <DateList
                                    dates={dates.filter(d => ['pending', 'confirmed', 'limbo'].includes(d.status))}
                                    emptyMessage="No upcoming dates."
                                    emptyDescription="When you and a match both like each other, a date will be automatically created!"
                                    navigate={navigate}
                                    userId={userId}
                                    isAdmin={isAdmin}
                                    onDelete={handleDeleteDate}
                                    onMarkCompleted={handleMarkCompleted}
                                />

                            </TabsContent>

                            <TabsContent value="completed" className="space-y-6">
                                <DateList
                                    dates={dates.filter(d => d.status === 'completed')}
                                    emptyMessage="No completed dates yet."
                                    emptyDescription="After a date is completed, it will be listed here!"
                                    navigate={navigate}
                                    userId={userId}
                                    isAdmin={isAdmin}
                                    onDelete={handleDeleteDate}
                                />
                            </TabsContent>

                            <TabsContent value="cancelled" className="space-y-6">
                                <DateList
                                    dates={dates.filter(d => d.status === 'cancelled')}
                                    emptyMessage="No cancelled dates."
                                    emptyDescription="Dates cancelled by you or your match will show up here."
                                    navigate={navigate}
                                    userId={userId}
                                    isCancelled
                                    isAdmin={isAdmin}
                                    onDelete={handleDeleteDate}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>
                    )}

                </div>

            </div >
        </>
    );
};

export default DatesList;
