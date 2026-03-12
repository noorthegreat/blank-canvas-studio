import { useState, useEffect, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, ChevronDown, ChevronRight } from "lucide-react";

interface EventAttendee {
    user_id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    event_name: string;
    gender: string;
    gender_source: 'personality' | 'friendship' | 'none';
}

export const AdminEventAttendeesTab = () => {
    const [attendees, setAttendees] = useState<EventAttendee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<{ id: string, event: string } | null>(null);
    const [likeDetails, setLikeDetails] = useState<{ outgoing: EventAttendee[], incoming: EventAttendee[] }>({ outgoing: [], incoming: [] });
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    useEffect(() => {
        loadAttendees();
    }, []);

    const loadAttendees = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Gender Question IDs and Options
            const { data: personalityQuestions } = await supabase
                .from('questionnaire_questions')
                .select('id, question, options')
                .ilike('question', '%gender%');

            const { data: friendshipQuestions } = await supabase
                .from('friendship_questions')
                .select('id, question, options')
                .ilike('question', '%gender%');

            const personalityGenderIds = personalityQuestions?.map(q => q.id) || [];
            const friendshipGenderIds = friendshipQuestions?.map(q => q.id) || [];

            // 2. Fetch Enrollments
            const { data: enrollments, error: enrollmentsError } = await supabase
                .from('event_enrollments')
                .select(`
                    user_id,
                    event_name,
                    profiles:user_id (
                        first_name
                    )
                `);

            if (enrollmentsError) throw enrollmentsError;

            if (!enrollments || enrollments.length === 0) {
                setAttendees([]);
                setIsLoading(false);
                return;
            }

            const userIds = enrollments.map(e => e.user_id);

            const { data: privateRows, error: privateError } = await supabase
                .from('private_profile_data' as any)
                .select('user_id, last_name, email')
                .in('user_id', userIds);
            if (privateError) throw privateError;
            const privateByUser = new Map((privateRows || []).map((r: any) => [r.user_id, r]));

            // 3. Fetch Answers
            // Personality Answers
            let personalityAnswers: any[] = [];
            if (personalityGenderIds.length > 0) {
                const { data } = await supabase
                    .from('personality_answers')
                    .select('user_id, answer, answer_custom, question_id')
                    .in('user_id', userIds)
                    .in('question_id', personalityGenderIds);
                personalityAnswers = data || [];
            }

            // Friendship Answers
            let friendshipAnswers: any[] = [];
            if (friendshipGenderIds.length > 0) {
                const { data } = await supabase
                    .from('friendship_answers')
                    .select('user_id, answer, answer_custom, question_id')
                    .in('user_id', userIds)
                    .in('question_id', friendshipGenderIds);
                friendshipAnswers = data || [];
            }

            const resolveGenderLabel = (answer: string, questionId: number, type: 'personality' | 'friendship') => {
                if (!answer) return "Unknown";

                const questions = type === 'personality' ? personalityQuestions : friendshipQuestions;
                const question = questions?.find(q => q.id === questionId);

                if (!question || !question.options) return answer;

                // Parse options if it's a string, otherwise cast to any
                let options: any[] = [];
                if (typeof question.options === 'string') {
                    try {
                        options = JSON.parse(question.options);
                    } catch (e) {
                        console.error("Error parsing options", e);
                        return answer;
                    }
                } else {
                    options = question.options as any[];
                }

                if (!Array.isArray(options)) return answer;

                const foundOption = options.find((opt: any) => opt.value === answer);
                return foundOption ? foundOption.label : answer;
            };

            // 4. Merge Data
            const mergedAttendees: EventAttendee[] = enrollments.map(enrollment => {
                const profile = enrollment.profiles as any;
                const userId = enrollment.user_id;
                const privateData = privateByUser.get(userId);

                // Find gender
                const pAnswer = personalityAnswers.find(a => a.user_id === userId);
                const fAnswer = friendshipAnswers.find(a => a.user_id === userId);

                let gender = "Unknown";
                let gender_source: 'personality' | 'friendship' | 'none' = 'none';

                if (pAnswer) {
                    if (pAnswer.answer_custom) {
                        gender = pAnswer.answer_custom;
                    } else {
                        gender = resolveGenderLabel(pAnswer.answer, pAnswer.question_id, 'personality');
                    }
                    gender_source = 'personality';
                } else if (fAnswer) {
                    if (fAnswer.answer_custom) {
                        gender = fAnswer.answer_custom;
                    } else {
                        gender = resolveGenderLabel(fAnswer.answer, fAnswer.question_id, 'friendship');
                    }
                    gender_source = 'friendship';
                }

                return {
                    user_id: userId,
                    first_name: profile?.first_name || 'Unknown',
                    last_name: privateData?.last_name ?? '',
                    email: privateData?.email ?? '',
                    event_name: enrollment.event_name,
                    gender,
                    gender_source
                };
            });

            setAttendees(mergedAttendees);

        } catch (error) {
            console.error("Error loading event attendees:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExpand = async (userId: string, eventName: string) => {
        if (expandedUser?.id === userId && expandedUser?.event === eventName) {
            setExpandedUser(null);
            return;
        }

        setExpandedUser({ id: userId, event: eventName });
        setIsLoadingDetails(true);
        setLikeDetails({ outgoing: [], incoming: [] });

        try {
            // Get all user IDs currently in the list for this event
            // Note: We filter by event_name to ensure we only care about people in THIS event
            const eventUserIds = new Set(
                attendees
                    .filter(a => a.event_name === eventName)
                    .map(a => a.user_id)
            );

            // Fetch Outgoing Likes
            const { data: outgoingData } = await supabase
                .from('likes')
                .select('liked_user_id')
                .eq('user_id', userId);

            // Fetch Incoming Likes
            const { data: incomingData } = await supabase
                .from('likes')
                .select('user_id')
                .eq('liked_user_id', userId);

            // Filter and Map Outgoing
            const outgoingIds = outgoingData?.map(l => l.liked_user_id) || [];
            const outgoingAttendees = attendees.filter(a =>
                a.event_name === eventName &&
                eventUserIds.has(a.user_id) &&
                outgoingIds.includes(a.user_id)
            );

            // Filter and Map Incoming
            const incomingIds = incomingData?.map(l => l.user_id) || [];
            const incomingAttendees = attendees.filter(a =>
                a.event_name === eventName &&
                eventUserIds.has(a.user_id) &&
                incomingIds.includes(a.user_id)
            );

            setLikeDetails({
                outgoing: outgoingAttendees,
                incoming: incomingAttendees
            });

        } catch (error) {
            console.error("Error fetching like details:", error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const downloadCSV = () => {
        if (!attendees.length) return;

        const headers = ["First Name", "Last Name", "Email", "Gender"];
        const rows = attendees.map(a => [
            a.first_name,
            a.last_name,
            a.email,
            a.gender
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `event_attendees_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Event Attendees
                </CardTitle>
                <button
                    onClick={downloadCSV}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                    Download CSV
                </button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>First Name</TableHead>
                            <TableHead>Last Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Gender</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {attendees.map((attendee, index) => {
                            const isExpanded = expandedUser?.id === attendee.user_id && expandedUser?.event === attendee.event_name;

                            return (
                                <Fragment key={`${attendee.user_id}-${attendee.event_name}-${index}`}>
                                    <TableRow className={isExpanded ? "border-b-0 bg-muted/50" : ""}>
                                        <TableCell>
                                            <button
                                                onClick={() => handleExpand(attendee.user_id, attendee.event_name)}
                                                className="p-1 hover:bg-slate-200 rounded"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                            </button>
                                        </TableCell>
                                        <TableCell className="font-medium">{attendee.event_name}</TableCell>
                                        <TableCell>{attendee.first_name}</TableCell>
                                        <TableCell>{attendee.last_name}</TableCell>
                                        <TableCell>{attendee.email}</TableCell>
                                        <TableCell>
                                            {attendee.gender}
                                            {attendee.gender_source !== 'none' && (
                                                <span className="text-xs text-muted-foreground ml-2 opacity-70">
                                                    ({attendee.gender_source})
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    {isExpanded && (
                                        <TableRow className="bg-muted">
                                            <TableCell colSpan={6}>
                                                <div className="p-4 space-y-4">
                                                    {isLoadingDetails ? (
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                            Loading details...
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-2 gap-8">
                                                            <div className="space-y-2">
                                                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                                                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                                                    They Liked ({likeDetails.outgoing.length})
                                                                </h4>
                                                                {likeDetails.outgoing.length > 0 ? (
                                                                    <ul className="text-sm space-y-1 pl-4 border-l-2 border-green-100">
                                                                        {likeDetails.outgoing.map(u => (
                                                                            <li key={u.user_id} className="text-muted-foreground hover:text-foreground">
                                                                                {u.first_name} {u.last_name} ({u.email})
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                ) : (
                                                                    <p className="text-xs text-muted-foreground pl-4">No likes in this event.</p>
                                                                )}
                                                            </div>

                                                            <div className="space-y-2">
                                                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                                                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                                                                    Liked Them ({likeDetails.incoming.length})
                                                                </h4>
                                                                {likeDetails.incoming.length > 0 ? (
                                                                    <ul className="text-sm space-y-1 pl-4 border-l-2 border-blue-100">
                                                                        {likeDetails.incoming.map(u => (
                                                                            <li key={u.user_id} className="text-muted-foreground hover:text-foreground">
                                                                                {u.first_name} {u.last_name} ({u.email})
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                ) : (
                                                                    <p className="text-xs text-muted-foreground pl-4">No likes from this event.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            );
                        })}
                        {attendees.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                    No event attendees found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
