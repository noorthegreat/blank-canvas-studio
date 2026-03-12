
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Sparkles, Calendar, MapPin, CalendarCheck, Building2, Mail, Trash2, RotateCcw, AlertTriangle, MoreVertical } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, addDays, setHours, setMinutes } from "date-fns";
import { AvailabilityPlanner, Availability, Venue, calculateLargestOverlap, Overlap } from "@/components/AvailabilityPlanner";
import { cn } from "@/lib/utils";
import { LongPressButton } from "@/components/ui/long-press-button";
import overlapExample from "@/assets/overlapExample.png";
import { VenueCard } from "@/components/VenueCard";
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

import ProfileViewDialog from "@/components/ProfileViewDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type DateType = {
    id: string;
    date_time: string | null;
    location: string | null;
    first_possible_day: string | null;
    user1_id: string;
    user2_id: string;
    user1_confirmed: boolean;
    user2_confirmed: boolean;
    matched_user: {
        id: string;
        first_name: string;
        last_name: string;
        phone_number: string | null;
        age: number | null;
        latitude: number | null;
        longitude: number | null;
        bio: string | null;
        additional_photos: string[] | null;
        created_at: string;
    };
    address: string | null;
    who_rescheduled: string | null;
    reschedule_reason: string | null;
    venue_options: string[] | null;
    user1_share_phone: boolean;
    user2_share_phone: boolean;
    timezone: string | null;
    status: "pending" | "confirmed" | "limbo" | "completed" | "cancelled" | "auto_cancelled";
    reschedule_count: number | null;
};

const ConfirmationStatusCard = ({ isConfirmed, isActive, label }: { isConfirmed: boolean; isActive: boolean; label: string }) => (
    <Card className={cn(
        "p-4 flex flex-col items-center justify-center gap-2 transition-colors",
        isActive ? "bg-green-50 border-green-200" : "",
        isConfirmed ? "bg-green-50/50 border-green-200/50" : "bg-muted/10"
    )}>
        <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            isConfirmed ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
        )}>
            {isConfirmed ? <CalendarCheck className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full bg-current" />}
        </div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">
            {isConfirmed ? "Confirmed" : "Pending"}
        </p>
    </Card>
);

// Helper: Check if confirmation status has changed and reload if needed
const checkConfirmationChanged = async (
    dateId: string,
    localDate: DateType,
    toast: ReturnType<typeof useToast>["toast"]
): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from("dates")
            .select("user1_confirmed, user2_confirmed")
            .eq("id", dateId)
            .single();

        if (error) throw error;

        const hasChanged =
            data.user1_confirmed !== localDate.user1_confirmed ||
            data.user2_confirmed !== localDate.user2_confirmed;

        if (hasChanged) {
            window.location.reload();
            toast({
                title: "Confirmation Updated",
                description: "Confirmation status has changed. Reloading...",
                variant: "destructive",
            });
            return true;
        }
        return false;
    } catch (error: any) {
        console.error("Error checking confirmation status:", error);
        toast({
            title: "Error",
            description: "Could not verify confirmation status. Please try again.",
            variant: "destructive",
        });
        return true; // Return true to prevent action on error
    }
};

// Helper: Get the matched user's ID
const getMatchedUserId = (date: DateType, userId: string): string =>
    date.user1_id === userId ? date.user2_id : date.user1_id;

// Helper: Check if current user is user1
const isUser1 = (date: DateType, userId: string): boolean =>
    userId === date.user1_id;

interface DateViewProps {
    dateId: string;
    viewerId: string;
    readOnly?: boolean;
}

type PrivateProfileData = {
    last_name: string | null;
    phone_number: string | null;
    latitude: number | null;
    longitude: number | null;
};

const loadLatestPrivateProfile = async (userId: string): Promise<PrivateProfileData | null> => {
    const { data, error } = await supabase
        .from("private_profile_data" as any)
        .select("last_name, phone_number, latitude, longitude, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data as unknown as PrivateProfileData | null;
};

const DateView = ({ dateId, viewerId, readOnly: readOnlyProp = false }: DateViewProps) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = useState<DateType | null>(null);
    const isCompleted = date?.status === "completed";
    const readOnly = readOnlyProp || isCompleted;
    const [availability, setAvailability] = useState<Availability>({});
    const [matchedAvailability, setMatchedAvailability] = useState<Availability>({});
    const [venues, setVenues] = useState<Record<string, Venue>>({});
    const [overlap, setOverlap] = useState<{ startDay: number; startSlot: number; endSlot: number; venue: "coffee" | "bar" } | null>(null);
    const [pendingAvailability, setPendingAvailability] = useState<{ dateId: string; availability: Availability } | null>(null);
    const [pendingAutoConfirm, setPendingAutoConfirm] = useState<{ dateId: string; availability: Availability; newOverlap: Overlap } | null>(null);
    const [confirmingDateId, setConfirmingDateId] = useState<string | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
    const [cancellationReason, setCancellationReason] = useState("");
    const [rescheduleReason, setRescheduleReason] = useState("");
    const [selectedRescheduleDate, setSelectedRescheduleDate] = useState<string>("");
    const [isCancelling, setIsCancelling] = useState(false);

    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        // Recalculate overlap when availabilities or venues change
        if (date && Object.keys(venues).length > 0) {
            setOverlap(calculateLargestOverlap(availability, matchedAvailability, venues));
        }
    }, [availability, matchedAvailability, venues, date]);

    useEffect(() => {
        // Determine the "current user" context for the logic
        const loadData = async () => {
            setIsLoading(true);

            const [{ data: userProfile }, userPrivate] = await Promise.all([
                supabase.from('profiles').select('first_name').eq('id', viewerId).maybeSingle(),
                loadLatestPrivateProfile(viewerId),
            ]);

            setCurrentUser(userProfile ? { ...userProfile, last_name: userPrivate?.last_name ?? null, phone_number: userPrivate?.phone_number ?? null } : null);

            if (dateId) {
                await loadDate(viewerId, dateId);
            }
            setIsLoading(false);
        };

        loadData();
    }, [dateId, viewerId]);

    const loadDate = async (currentUserId: string, dateId: string) => {
        try {
            // Fetch date
            const { data: dateData, error: dateError } = await supabase
                .from("dates")
                .select("*")
                .eq("id", dateId)
                .single();

            if (dateError) throw dateError;

            if (!dateData) {
                toast({ title: "Error", description: "Date not found", variant: "destructive" });
                return;
            }

            // Check if user is part of this date (skip if readOnly, but logic still depends on it)
            if (!readOnly && dateData.user1_id !== currentUserId && dateData.user2_id !== currentUserId) {
                toast({ title: "Error", description: "Unauthorized", variant: "destructive" });
                return;
            }

            // Fetch venues
            let venuesQuery = supabase.from("venues").select("*");

            // Filter venues if venue_options exists
            if (dateData.venue_options && dateData.venue_options.length > 0) {
                venuesQuery = venuesQuery.in("id", dateData.venue_options);
            }

            const { data: venuesData, error: venuesError } = await venuesQuery;

            if (venuesError) throw venuesError;

            const venuesMap: Record<string, Venue> = {};
            venuesData?.forEach((v: any) => {
                venuesMap[v.type] = v;
            });
            setVenues(venuesMap);

            // Get matched user profile
            const matchedUserId = dateData.user1_id === currentUserId ? dateData.user2_id : dateData.user1_id;

            const [{ data: profileData, error: profileError }, matchedPrivate] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("id, first_name, age, bio, additional_photos, created_at")
                    .eq("id", matchedUserId)
                    .maybeSingle(),
                loadLatestPrivateProfile(matchedUserId),
            ]);

            if (profileError) throw profileError;

            const dateObj: DateType = {
                id: dateData.id,
                date_time: dateData.date_time,
                location: dateData.location,
                first_possible_day: dateData.first_possible_day,
                user1_id: dateData.user1_id,
                user2_id: dateData.user2_id,
                user1_confirmed: dateData.user1_confirmed,
                user2_confirmed: dateData.user2_confirmed,
                matched_user: profileData ? {
                    ...profileData,
                    last_name: matchedPrivate?.last_name ?? "",
                    phone_number: matchedPrivate?.phone_number ?? null,
                    latitude: matchedPrivate?.latitude ?? null,
                    longitude: matchedPrivate?.longitude ?? null,
                } : {
                    id: matchedUserId,
                    first_name: "Unknown User",
                    last_name: "",
                    phone_number: null,
                    age: null,
                    latitude: null,
                    longitude: null,
                    bio: null,
                    additional_photos: null,
                    created_at: new Date().toISOString(),
                },
                address: dateData.address,
                who_rescheduled: dateData.who_rescheduled,
                reschedule_reason: dateData.reschedule_reason,
                venue_options: dateData.venue_options,
                user1_share_phone: dateData.user1_share_phone,
                user2_share_phone: dateData.user2_share_phone,
                timezone: dateData.timezone,
                status: dateData.status,
                reschedule_count: dateData.reschedule_count,
            };

            setDate(dateObj);

            // Set availabilities from the date data
            const isUser1 = currentUserId === dateData.user1_id;
            const myAvail = (isUser1 ? dateData.user1_availability : dateData.user2_availability) as Availability || {};
            const matchedAvail = (isUser1 ? dateData.user2_availability : dateData.user1_availability) as Availability || {};
            setAvailability(myAvail);
            setMatchedAvailability(matchedAvail);

        } catch (error: any) {
            console.error("Error loading date:", error);
            toast({
                title: "Error loading date",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const saveAvailabilityToDb = async (dateId: string, newAvailability: Availability) => {
        if (!viewerId || !date || readOnly) return;

        // Check if confirmation status has changed before saving
        if (await checkConfirmationChanged(dateId, date, toast)) return;

        // Optimistic update
        setAvailability(newAvailability);

        const updateField = isUser1(date, viewerId) ? "user1_availability" : "user2_availability";

        const { error } = await supabase
            .from("dates")
            .update({ [updateField]: newAvailability })
            .eq("id", dateId);

        if (error) {
            console.error("Error saving availability:", error);
            toast({
                title: "Error saving availability",
                description: error.message,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Availability saved",
                description: "Your availability has been updated.",
            });
        }
        setPendingAvailability(null);
    };

    const handleSaveAvailability = async (dateId: string, newAvailability: Availability) => {
        if (readOnly) return;

        // Check if there is an overlap
        const hasMatchedAvail = Object.values(matchedAvailability).some(slots => slots.length > 0);

        // Calculate overlap with the NEW availability
        const newOverlap = calculateLargestOverlap(newAvailability, matchedAvailability, venues);

        if (hasMatchedAvail && !newOverlap) {
            // The other user has availability, but we found no overlap. Warn the user.
            setPendingAvailability({ dateId, availability: newAvailability });

            // Reset confirmations
            const { error } = await supabase
                .from("dates")
                .update({
                    user1_confirmed: false,
                    user2_confirmed: false,
                    location: null,
                    address: null,
                    date_time: null,
                    status: "pending"
                })
                .eq("id", dateId);

            if (error) {
                console.error("Error resetting confirmations:", error);
                toast({
                    title: "Error updating date status",
                    description: "Could not reset confirmation status.",
                    variant: "destructive",
                });
            } else {
                // Optimistic update for date object
                setDate(prev => prev ? ({
                    ...prev,
                    user1_confirmed: false,
                    user2_confirmed: false,
                    location: null,
                    address: null,
                    date_time: null,
                    status: "pending"
                }) : null);
            }
        } else if (newOverlap && (!overlap || overlap.startDay !== newOverlap.startDay ||
            overlap.startSlot !== newOverlap.startSlot ||
            overlap.endSlot !== newOverlap.endSlot ||
            overlap.venue !== newOverlap.venue
        )) {
            // Overlap changed or is new! Ask to auto-confirm.
            setPendingAutoConfirm({ dateId, availability: newAvailability, newOverlap });
        } else {
            // Either there is no overlap, or the overlap didn't change. Save directly.
            await saveAvailabilityToDb(dateId, newAvailability);
        }
    };

    const handleAutoConfirm = async () => {
        if (!pendingAutoConfirm || !viewerId || readOnly || !date) return;

        const { dateId, availability: newAvailability, newOverlap } = pendingAutoConfirm;

        // Save availability
        await saveAvailabilityToDb(dateId, newAvailability);

        // Calculate date details
        const meetingDate = calculateMeetingDate(newOverlap.startDay);
        const hour = Math.floor(newOverlap.startSlot / 2);
        const minute = (newOverlap.startSlot % 2) * 30;
        const finalDate = setMinutes(setHours(meetingDate, hour), minute);

        const updates = {
            user1_confirmed: true,
            user2_confirmed: true,
            status: "confirmed" as const,
            location: venues[newOverlap.venue]?.name,
            address: venues[newOverlap.venue]?.address,
            date_time: finalDate.toISOString()
        };

        // Optimistic update for date object
        setDate(prev => prev ? ({
            ...prev,
            ...updates
        }) : null);

        try {
            const { error } = await supabase
                .from("dates")
                .update(updates)
                .eq("id", dateId);

            if (error) throw error;

            // Date is fully confirmed! Send details email to BOTH users
            if (currentUser && updates.date_time) {
                const matchedUserId = getMatchedUserId(date, viewerId);
                const matchedUserName = date.matched_user.first_name;

                const finalDateObj = new Date(updates.date_time);
                const dateString = format(finalDateObj, "MMMM d");
                const weekday = format(finalDateObj, "EEEE");
                const timeString = format(finalDateObj, "h:mm a");

                const dateDetails = {
                    date: dateString,
                    weekday: weekday,
                    time: timeString,
                    locationName: updates.location,
                    locationAddress: updates.address
                };

                await supabase.functions.invoke('send-user-emails', {
                    body: {
                        dateId,
                        emailType: 'date_confirmed_details',
                        recipients: [
                            {
                                userId: viewerId,
                                customData: {
                                    partnerName: matchedUserName,
                                    dateDetails
                                }
                            },
                            {
                                userId: matchedUserId,
                                customData: {
                                    partnerName: currentUser.first_name,
                                    dateDetails
                                }
                            }
                        ]
                    }
                });
            }

            toast({
                title: "Date confirmed!",
                description: "Your date time and location have been set.",
            });
        } catch (error: any) {
            console.error("Error setting date:", error);
            toast({
                title: "Error setting date",
                description: "Could not completely set the date.",
                variant: "destructive",
            });
        }

        setPendingAutoConfirm(null);
    };

    // We'll keep the confirmation code in for now, but handleConfirmOverlapChange is removed
    // since we automaticually confirm dates now on overlap.

    const handleCancelDate = async () => {
        if (!date || !viewerId || readOnly) return;
        let reason = cancellationReason
        if (!reason.trim()) {
            reason = "No reason provided";
        }

        try {
            setIsCancelling(true);
            const feedbackField = isUser1(date, viewerId) ? "user1_feedback" : "user2_feedback";

            const { error } = await supabase
                .from("dates")
                .update({
                    status: "cancelled",
                    [feedbackField]: reason
                })
                .eq("id", date.id);

            if (error) throw error;

            // Send email to the other user
            const matchedUserId = getMatchedUserId(date, viewerId);

            // Get current user's name for the email
            const { data: currentUserProfile } = await supabase
                .from('profiles')
                .select('first_name')
                .eq('id', viewerId)
                .single();

            if (currentUserProfile) {
                const { error: emailError } = await supabase.functions.invoke('send-user-emails', {
                    body: {
                        dateId: date.id,
                        emailType: 'date_cancelled',
                        recipients: [
                            {
                                userId: matchedUserId,
                                customData: {
                                    partnerName: currentUserProfile.first_name,
                                    cancellationReason: reason
                                }
                            }
                        ]
                    }
                });

                if (emailError) {
                    console.error("Error sending cancellation email:", emailError);
                }
            }

            // Remove matches for both users
            const { error: deleteMatchError } = await supabase
                .from("matches")
                .delete()
                .or(`and(user_id.eq.${date.user1_id},matched_user_id.eq.${date.user2_id}),and(user_id.eq.${date.user2_id},matched_user_id.eq.${date.user1_id})`);

            if (deleteMatchError) { console.error(deleteMatchError) };

            // Delete likes for both users so they don't match again immediately if they browse matches
            const { error: deleteLikesError } = await supabase
                .from("likes")
                .delete()
                .or(`and(user_id.eq.${date.user1_id},liked_user_id.eq.${date.user2_id}),and(user_id.eq.${date.user2_id},liked_user_id.eq.${date.user1_id})`);

            if (deleteLikesError) { console.error(deleteLikesError) }

            toast({
                title: "Date cancelled",
                description: "The date has been cancelled.",
            });
            setIsCancelDialogOpen(false);
            setCancellationReason("");
            navigate("/dates");

        } catch (error: any) {
            console.error("Error cancelling date:", error);
            toast({
                title: "Error cancelling date",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsCancelling(false);
        }
    };

    const handleRescheduleDate = async () => {
        if (!date || !viewerId || !date.first_possible_day || readOnly) return;

        // Use selected date or default to 1 week out if not set (though UI should enforce it)
        const currentStart = parseISO(date.first_possible_day);
        let newStartStr = selectedRescheduleDate;

        if (!newStartStr) {
            newStartStr = format(addDays(currentStart, 7), 'yyyy-MM-dd');
        }

        try {
            const newFirstPossibleDay = newStartStr;
            const newRescheduleCount = (date.reschedule_count || 0) + 1;

            // Optimistic update
            setDate(prev => prev ? ({
                ...prev,
                first_possible_day: newFirstPossibleDay,
                user1_confirmed: false,
                user2_confirmed: false,
                location: null,
                address: null,
                date_time: null,
                who_rescheduled: viewerId,
                status: 'pending',
                reschedule_reason: rescheduleReason,
                reschedule_count: newRescheduleCount
            }) : null);
            setAvailability({});
            setMatchedAvailability({});
            setOverlap(null);

            // Update dates table
            const { error: dateError } = await supabase
                .from("dates")
                .update({
                    first_possible_day: newFirstPossibleDay,
                    user1_confirmed: false,
                    user2_confirmed: false,
                    location: null,
                    address: null,
                    date_time: null,
                    who_rescheduled: viewerId,
                    status: 'pending',
                    reschedule_reason: rescheduleReason, // Add reason to DB
                    reschedule_count: newRescheduleCount
                })
                .eq("id", date.id);

            if (dateError) throw dateError;

            // Send email to the other user
            if (currentUser && date && viewerId) {
                const matchedUserId = getMatchedUserId(date, viewerId);
                await supabase.functions.invoke('send-user-emails', {
                    body: {
                        dateId: date.id,
                        emailType: 'date_rescheduled',
                        recipients: [
                            {
                                userId: matchedUserId,
                                customData: {
                                    partnerName: currentUser.first_name,
                                    rescheduleReason // Pass reason to email
                                }
                            }
                        ]
                    }
                });
            }

            toast({
                title: "Date Rescheduled",
                description: "The date has been moved back. Please re-enter your availability.",
            });
            setIsRescheduleDialogOpen(false);

        } catch (error: any) {
            console.error("Error rescheduling date:", error);
            toast({
                title: "Error rescheduling date",
                description: error.message,
                variant: "destructive",
            });
            // Reload date to revert optimistic updates
            loadDate(viewerId, date.id);
        }
    };

    const handleConfirmDate = async (dateId: string) => {
        if (!viewerId || !date || !overlap || readOnly) return;

        // Check if confirmation status has changed before confirming
        if (await checkConfirmationChanged(dateId, date, toast)) return;

        const updateField = isUser1(date, viewerId) ? "user1_confirmed" : "user2_confirmed";
        const bothUsersConfirmed = isUser1(date, viewerId) ? date.user2_confirmed : date.user1_confirmed;

        let updates: any = { [updateField]: true };
        let optimisticUpdates: any = { [updateField]: true };

        if (bothUsersConfirmed && date.first_possible_day) {
            // Both confirmed! Calculate date_time and location
            const meetingDate = calculateMeetingDate(overlap.startDay);

            const hour = Math.floor(overlap.startSlot / 2);
            const minute = (overlap.startSlot % 2) * 30;

            const finalDate = setMinutes(setHours(meetingDate, hour), minute);

            updates.date_time = finalDate.toISOString();
            updates.location = venues[overlap.venue]?.name;
            updates.address = venues[overlap.venue]?.address;
            updates.status = "confirmed";

            optimisticUpdates.date_time = finalDate.toISOString();
            optimisticUpdates.location = venues[overlap.venue]?.name;
            optimisticUpdates.address = venues[overlap.venue]?.address;
            optimisticUpdates.status = "confirmed";
        }

        // Optimistic update
        setDate(prev => prev ? ({ ...prev, ...optimisticUpdates }) : null);

        try {
            const { error } = await supabase
                .from("dates")
                .update(updates)
                .eq("id", dateId);

            if (error) throw error;

            // If this was the first confirmation (meaning the date wasn't fully confirmed yet), send an email to the other user
            if (!bothUsersConfirmed && currentUser) {
                const matchedUserId = getMatchedUserId(date, viewerId);

                await supabase.functions.invoke('send-user-emails', {
                    body: {
                        dateId,
                        emailType: 'first_confirm',
                        recipients: [
                            {
                                userId: matchedUserId,
                                customData: {
                                    partnerName: currentUser.first_name
                                }
                            }
                        ]
                    }
                });
            } else if (bothUsersConfirmed && currentUser && updates.date_time) {
                // Date is fully confirmed! Send details email to BOTH users
                const matchedUserId = getMatchedUserId(date, viewerId);
                const matchedUserName = date.matched_user.first_name;

                const finalDateObj = new Date(updates.date_time);
                const dateString = format(finalDateObj, "MMMM d"); // Oct 15
                const weekday = format(finalDateObj, "EEEE"); // Monday
                const timeString = format(finalDateObj, "h:mm a"); // 7:30 PM

                const dateDetails = {
                    date: dateString,
                    weekday: weekday,
                    time: timeString,
                    locationName: updates.location,
                    locationAddress: updates.address
                };

                await supabase.functions.invoke('send-user-emails', {
                    body: {
                        dateId,
                        emailType: 'date_confirmed_details',
                        recipients: [
                            {
                                userId: viewerId, // Current user
                                customData: {
                                    partnerName: matchedUserName,
                                    dateDetails
                                }
                            },
                            {
                                userId: matchedUserId, // Partner
                                customData: {
                                    partnerName: currentUser.first_name,
                                    dateDetails
                                }
                            }
                        ]
                    }
                });
            }

            toast({
                title: "Date confirmed!",
                description: "You have confirmed the date time and location.",
            });
        } catch (error: any) {
            console.error("Error confirming date:", error);
            toast({
                title: "Error confirming date",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleTogglePhoneShare = async (checked: boolean) => {
        if (!date || !viewerId || readOnly) return;

        const field = isUser1(date, viewerId) ? "user1_share_phone" : "user2_share_phone";

        // Optimistic update
        setDate(prev => prev ? ({ ...prev, [field]: checked }) : null);

        const { error } = await supabase
            .from("dates")
            .update({ [field]: checked })
            .eq("id", date.id);

        if (error) {
            console.error("Error updating phone share preference:", error);
            toast({
                title: "Error",
                description: "Could not update preference.",
                variant: "destructive",
            });
            // Revert
            setDate(prev => prev ? ({ ...prev, [field]: !checked }) : null);
        }
        toast({
            title: "Phone preference updated!",
            description: "Your phone share preference has been updated.",
        });
    };

    const calculateMeetingDate = (targetDayIndex: number) => {
        if (!date?.first_possible_day) return new Date();
        const startDate = parseISO(date.first_possible_day);

        for (let i = 0; i < 7; i++) {
            const current = addDays(startDate, i);
            if (current.getDay() === targetDayIndex) {
                return current;
            }
        }
        return startDate;
    };

    const getCalendarDate = (startDay: number) => {
        const meetingDate = calculateMeetingDate(startDay);
        return format(meetingDate, "EEEE, MMM d");
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Sparkles className="w-12 h-12 text-primary animate-pulse" />
            </div>
        );
    }

    if (!date) {
        return (
            <div className="text-center p-8 text-white">Date not found.</div>
        )
    }

    return (
        <>
            <ProfileViewDialog
                profile={date.matched_user}
                open={isProfileOpen}
                onOpenChange={setIsProfileOpen}
            />

            {readOnly && (
                <div className={cn(
                    "border-l-4 p-4 mb-4 rounded shadow-xs",
                    isCompleted ? "bg-green-100 border-green-500 text-green-700" : "bg-amber-100 border-amber-500 text-amber-700"
                )} role="alert">
                    <p className="font-bold">
                        {isCompleted ? "Date Completed" : "Read Only View"}
                    </p>
                    <p>
                        {isCompleted
                            ? "This date has been marked as completed. You can view the details but cannot make changes."
                            : <span>You are viewing this date as <strong>{currentUser?.first_name} {currentUser?.last_name}</strong>.</span>
                        }
                    </p>
                </div>
            )}

            <Card className="shadow-lg border-border/50">
                <CardHeader>
                    <CardTitle className="flex justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Avatar className="h-16 w-16 border-2 border-primary/20 cursor-pointer" onClick={() => setIsProfileOpen(true)}>
                                <AvatarImage src={date.matched_user.additional_photos?.[0]} className="object-cover" />
                                <AvatarFallback>{date.matched_user.first_name[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-2xl">Date with {date.matched_user.first_name}</span>
                        </div>

                        {!readOnly && (
                            <div className="flex gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="lg" className=" text-muted-foreground p-0 -mr-2">
                                            <MoreVertical className="min-w-6 min-h-6" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => setIsRescheduleDialogOpen(true)} className="cursor-pointer">
                                            <RotateCcw className="w-4 h-4 mr-2" />
                                            <span>Reschedule Date</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setIsCancelDialogOpen(true)} className="text-destructive focus:text-destructive cursor-pointer">
                                            <X className="w-4 h-4 mr-2" />
                                            <span>Cancel Date</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Cancel Date?</AlertDialogTitle>
                                            <AlertDialogDescription className="space-y-4">
                                                <p>Are you sure you want to cancel this date? <strong>Doing this will remove your match</strong>. Note that you can always reschedule your availability, even after confirming.</p>
                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium text-foreground">Send a reason to your match (optional):</p>
                                                    <Textarea
                                                        placeholder="Not feeling well / my car broke down / etc..."
                                                        value={cancellationReason}
                                                        onChange={(e) => setCancellationReason(e.target.value)}
                                                        className="bg-background"
                                                    />
                                                </div>
                                                <p> This action cannot be undone, though you may be able to be matched again in the future :)</p>
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Back</AlertDialogCancel>
                                            <LongPressButton
                                                onLongPress={handleCancelDate}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                progressColor="bg-red-700/60"
                                                disabled={isCancelling}
                                            >
                                                {isCancelling ? "Cancelling..." : "Hold to Cancel & Unmatch"} {!isCancelling && <Trash2 className="ml-2 w-4 h-4" />}
                                            </LongPressButton>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                                <AlertDialog open={isRescheduleDialogOpen} onOpenChange={(open) => {
                                    setIsRescheduleDialogOpen(open);
                                    if (open && date?.first_possible_day) {
                                        // Default to next week when opening
                                        const nextWeek = format(addDays(parseISO(date.first_possible_day), 7), 'yyyy-MM-dd');
                                        setSelectedRescheduleDate(nextWeek);
                                    }
                                }}>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                {(date.reschedule_count || 0) >= 2
                                                    ? "Date Reschedule Limit Reached"
                                                    : (date.reschedule_count || 0) > 0
                                                        ? "Reschedule Date Again?"
                                                        : "Reschedule Date?"}
                                            </AlertDialogTitle>
                                            <AlertDialogDescription className="space-y-4">
                                                {(date.reschedule_count || 0) >= 2 ? (
                                                    <div className="space-y-4">
                                                        <p className="text-base">
                                                            This date has already been rescheduled twice.
                                                        </p>
                                                        {date.who_rescheduled && (
                                                            <p className="text-sm text-muted-foreground">
                                                                Last rescheduled by <strong>{date.who_rescheduled === viewerId ? "you" : date.matched_user.first_name}</strong>.
                                                            </p>
                                                        )}
                                                        {(date as any).reschedule_reason && (
                                                            <div className="bg-muted p-3 rounded-md italic text-muted-foreground">
                                                                "{(date as any).reschedule_reason}"
                                                            </div>
                                                        )}
                                                        <p className="text-sm text-muted-foreground">
                                                            Dates can only be rescheduled up to two times. If you need to make further changes, please coordinate directly with your match.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {(date.reschedule_count || 0) > 0 && (
                                                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-sm mb-4">
                                                                <p className="font-bold">Heads up:</p>
                                                                <p>You can reschedule this date one more time.</p>
                                                            </div>
                                                        )}
                                                        <p>Are you sure you want to reschedule this date?</p>
                                                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 text-sm">
                                                            <p className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Warning:</p>
                                                            <ul className="list-disc list-inside mt-2 space-y-1">
                                                                <li>This can only be done <strong>twice</strong> per date.</li>
                                                                <li>Both you and your match will need to <strong>re-enter availability</strong>.</li>
                                                                <li>Any existing confirmations will be reset.</li>
                                                            </ul>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <p className="text-sm font-medium text-foreground">Select new week:</p>
                                                            <select
                                                                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                                value={selectedRescheduleDate}
                                                                onChange={(e) => setSelectedRescheduleDate(e.target.value)}
                                                            >
                                                                {[1, 2, 3, 4, 5, 6].map(weeksAhead => {
                                                                    if (!date.first_possible_day) return null;
                                                                    const start = parseISO(date.first_possible_day);
                                                                    const newStart = addDays(start, weeksAhead * 7);
                                                                    const newEnd = addDays(newStart, 6);
                                                                    const label = `${format(newStart, "MMM d")} - ${format(newEnd, "MMM d")}`;
                                                                    const value = format(newStart, 'yyyy-MM-dd');
                                                                    return (
                                                                        <option key={value} value={value}>
                                                                            {weeksAhead === 1 ? "Next Week" : `${weeksAhead} Weeks Out`} ({label})
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <p className="text-sm font-medium text-foreground">Send a reason to your match (optional):</p>
                                                            <Textarea
                                                                placeholder="I'm busy next week / need more time / etc..."
                                                                value={rescheduleReason}
                                                                onChange={(e) => setRescheduleReason(e.target.value)}
                                                                className="bg-background"
                                                            />
                                                        </div>

                                                        <p>Doing this will send a notification to your match.</p>
                                                    </>
                                                )}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{(date.reschedule_count || 0) >= 2 ? "Close" : "Back"}</AlertDialogCancel>
                                            {(date.reschedule_count || 0) < 2 && (
                                                <LongPressButton
                                                    onLongPress={handleRescheduleDate}
                                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                                >
                                                    Hold to Reschedule<Calendar className="ml-2 w-4 h-4" />
                                                </LongPressButton>
                                            )}
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        )}
                    </CardTitle>
                    <CardDescription className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div>
                                {date.date_time && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        <span>{format(new Date(date.date_time), "EEEE, MMMM d, yyyy 'at' h:mm a")}</span>
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
                        </div>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 md:p-6 px-0">


                    {/* Availability Planner */}
                    <div>
                        <div className="text-center text-muted-foreground flex items-center justify-center gap-2 px-6">
                            <p>Click-and-drag to set your availability!<br />
                                We'll find a good time & place for both of you.</p>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                            <strong></strong>
                        </p>
                        <AvailabilityPlanner
                            initialAvailability={availability}
                            matchedUserAvailability={matchedAvailability}
                            onSave={(newAvailability, overlap) => handleSaveAvailability(date.id, newAvailability)}
                            venues={venues}
                            firstPossibleDay={date.first_possible_day}
                            readOnly={readOnly}
                        />
                    </div>


                    {/* Phone Share Toggle */}
                    <div className="mt-6 mx-6 flex items-center justify-between bg-muted/20 p-4 rounded-lg border border-border/50">
                        <div className="space-y-1">
                            <div className="flex flex-col gap-2">
                                <span className="font-medium text-sm">Email my phone number 1 hour before date:</span>
                                <div className="pointer-events-none opacity-80">
                                    <PhoneInput
                                        country={"ch"}
                                        preferredCountries={['ch', 'de', 'us']}
                                        value={currentUser?.phone_number || ""}
                                        disabled={true}
                                        disableDropdown={true}
                                        containerStyle={{ border: 'none', padding: 0, margin: 0 }}
                                        inputStyle={{ background: 'transparent', border: 'none', paddingLeft: '40px', width: '100%', color: 'currentColor' }}
                                        buttonStyle={{ background: 'transparent', border: 'none' }}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Completely optional, but can be helpful to coordinate last-minute date logistics with your match :)
                            </p>
                        </div>
                        <Switch
                            checked={isUser1(date, viewerId) ? date.user1_share_phone : date.user2_share_phone}
                            onCheckedChange={handleTogglePhoneShare}
                            disabled={readOnly}
                        />
                    </div>
                    {(() => {
                        const partnerShares = isUser1(date, viewerId) ? date.user2_share_phone : date.user1_share_phone;
                        if (partnerShares) {
                            return (
                                <div className="mb-6 text-sm text-center p-2 bg-green-50 text-green-800 rounded border border-green-200">
                                    We'll email you {date.matched_user.first_name}'s phone number 1 hour before the date.
                                </div>
                            )
                        }
                        return null;
                    })()}


                </CardContent>
            </Card>

            <AlertDialog open={!!pendingAvailability} onOpenChange={(open) => !open && setPendingAvailability(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>No Overlap Found :(</AlertDialogTitle>
                        <AlertDialogDescription>
                            It looks like your availability doesn't overlap with the other user's availability.
                            <br />
                            <i>Please try and find a time that works for both of you!</i> <br />
                            <div className="m-4 flex justify-center">
                                <div className="rounded-md bg-muted p-2 flex-col">
                                    <div className="flex"><div><strong>Tip:</strong> Overlap is shown with a <span className="text-teal-500 font-bold">teal</span> square: </div> <div className="ml-2 w-5 h-5 bg-teal-500/90 rounded"></div></div>
                                    <div>when <span className="font-bold text-green-500">your availability</span> overlaps with <span className="font-bold text-blue-400">your match's availability</span>.</div>
                                    <div className="m-2 flex justify-center"><img src={overlapExample} alt="Overlap Example" /></div>
                                    <div>This image shows availability overlap on Monday from 9:30AM - 10:30AM.</div>
                                </div>
                            </div>

                            If this <strong>really isn't possible</strong>, you can save anyway and we'll notify the other user to ask if they can expand their availability - but if no overlap is found before <strong>{pendingAvailability && date?.first_possible_day ? format(parseISO(date.first_possible_day), "MMM d") : "the date is scheduled"}</strong>, the match may be cancelled.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction>Keep Editing</AlertDialogAction>
                        <LongPressButton
                            onLongPress={async () => {
                                if (pendingAvailability) {
                                    await saveAvailabilityToDb(pendingAvailability.dateId, pendingAvailability.availability);

                                    if (currentUser && date && viewerId) {
                                        const matchedUserId = getMatchedUserId(date, viewerId);
                                        await supabase.functions.invoke('send-user-emails', {
                                            body: {
                                                dateId: pendingAvailability.dateId,
                                                emailType: 'no_overlap',
                                                recipients: [
                                                    {
                                                        userId: matchedUserId,
                                                        customData: {
                                                            partnerName: currentUser.first_name
                                                        }
                                                    }
                                                ]
                                            }
                                        });
                                    }
                                }
                            }}
                            className="bg-white text-primary outline-1 outline-solid hover:bg-primary/10"
                        >
                            Hold to Save Anyway & Notify Match<Mail />
                        </LongPressButton>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!pendingAutoConfirm} onOpenChange={(open) => !open && setPendingAutoConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Setup Date?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will set up the date and notify your match!
                            <br /><br />
                            Time: <strong>{pendingAutoConfirm?.newOverlap && formatTime(pendingAutoConfirm.newOverlap.startSlot)}</strong> on <strong>{pendingAutoConfirm?.newOverlap && getCalendarDate(pendingAutoConfirm.newOverlap.startDay)}</strong>
                            <br />
                            Location: <strong>{pendingAutoConfirm?.newOverlap && venues[pendingAutoConfirm.newOverlap.venue]?.name}</strong>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleAutoConfirm}>
                            Save & Set Date
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

// Helper for time formatting in the confirmation card
const formatTime = (slot: number) => {
    const hourVal = Math.floor(slot / 2);
    const minuteVal = (slot % 2) * 30;
    const period = hourVal >= 12 ? "PM" : "AM";
    const displayHour = hourVal === 0 ? 12 : hourVal > 12 ? hourVal - 12 : hourVal;
    return `${displayHour}:${minuteVal.toString().padStart(2, '0')} ${period}`;
};

export default DateView;
