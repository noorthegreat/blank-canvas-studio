import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, MapPin, ExternalLink, Users, ClipboardCheck, Heart, PartyPopper } from "lucide-react";
import FlyerImage from "@/assets/match_lab_flyer.jpeg";
import { Badge } from "@/components/ui/badge";
import Footer from "./Footer";

type Enrollment = {
    user_id: string;
    created_at: string;
    profiles?: {
        first_name: string;
        last_name: string | null;
    } | null;
};

const Event = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [sessionUser, setSessionUser] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<any>(null);

    const EVENT_NAME = "match_lab_plaza_feb_05";

    useEffect(() => {
        checkSession();
        fetchEnrollments();
    }, []);

    const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            navigate("/auth");
            return;
        }
        setSessionUser(session.user);
        checkEnrollmentStatus(session.user.id);

        const { data: profile } = await supabase
            .from("profiles")
            .select("completed_questionnaire, completed_friendship_questionnaire")
            .eq("id", session.user.id)
            .maybeSingle();

        if (profile) {
            setUserProfile(profile);
        }
    };

    const checkEnrollmentStatus = async (userId: string) => {
        const { data, error } = await supabase
            .from("event_enrollments")
            .select("*")
            .eq("user_id", userId)
            .eq("event_name", EVENT_NAME)
            .maybeSingle();

        if (error) {
            console.error("Error checking status", error);
        }

        setIsEnrolled(!!data);
    };

    const fetchEnrollments = async () => {
        setLoading(true);
        // Ideally we would join with profiles here, but for now let's just show IDs or raw count
        // If you need names, you'd need to adjust the query or permissions
        const { data, error } = await supabase
            .from("event_enrollments")
            .select("user_id, created_at") // Assuming profiles relation is accessible
            .eq("event_name", EVENT_NAME)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching enrollments", error);
            toast({
                title: "Could not load roster",
                description: error.message,
                variant: "destructive",
            });
        } else {
            setEnrollments(data as any || []);
        }
        setLoading(false);
    };

    const toggleEnrollment = async () => {
        if (!sessionUser) return;
        setEnrolling(true);

        try {
            if (isEnrolled) {
                // Unenroll
                const { error } = await supabase
                    .from("event_enrollments")
                    .delete()
                    .eq("user_id", sessionUser.id)
                    .eq("event_name", EVENT_NAME);

                if (error) throw error;

                setIsEnrolled(false);
                toast({
                    title: "Unenrolled",
                    description: "You have been removed from the event roster.",
                });
            } else {
                // Enroll
                const { error } = await supabase
                    .from("event_enrollments")
                    .insert({
                        user_id: sessionUser.id,
                        event_name: EVENT_NAME
                    });

                if (error) throw error;

                setIsEnrolled(true);
                toast({
                    title: "You're going!",
                    description: "See you at the Match Lab!",
                });
            }
            // Refresh list
            fetchEnrollments();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setEnrolling(false);
        }
    };

    const SHOW_ROSTER = true;
    return (
        <>
            <div className="min-h-screen bg-background">
                <div className="max-w-4xl mx-auto p-4 py-8 space-y-4">

                    <div className="text-center space-y-4">
                        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-linear-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                            Match Lab x Plaza
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            A special matchmaking event at Plaza Klub.
                        </p>
                    </div>

                    {/* How it works Section */}
                    <h2 className="text-2xl font-bold">How it works</h2>
                    <div className="space-y-4">
                        <div className="grid md:grid-cols-3 gap-4">
                            <Card
                                className="cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => navigate("/questionnaire-intro")}
                            >
                                <CardContent className="pt-6 flex flex-col items-center text-center space-y-2">
                                    <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                                        <ClipboardCheck className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-semibold">1. Take the Survey</h3>
                                    <p className="text-sm text-muted-foreground pb-2">
                                        Complete one of our compatibility surveys, for dates or just friendship.
                                    </p>
                                    <div className="flex flex-col gap-2 w-full px-4">
                                        {userProfile && (
                                            <>
                                                {userProfile.completed_friendship_questionnaire ? (
                                                    <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 w-full justify-center">
                                                        Friendship Survey Completed
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10 w-full justify-center">
                                                        Friendship Survey Not Completed
                                                    </Badge>
                                                )}

                                                {userProfile.completed_questionnaire ? (
                                                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-100 w-full justify-center">
                                                        Compatibility Survey Completed
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10 w-full justify-center">
                                                        Compatibility Survey Not Completed
                                                    </Badge>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card
                                className="cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => navigate("/matches")}
                            >
                                <CardContent className="pt-6 flex flex-col items-center text-center space-y-2">
                                    <div className="p-3 rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400">
                                        <Heart className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-semibold">2. Pick Your Favorites</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Starting Jan 30th, we'll show you your most compatible matches, and you let us know which ones you like.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6 flex flex-col items-center text-center space-y-2">
                                    <div className="p-3 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                                        <PartyPopper className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-semibold">3. Meet at the MatchLab Mingle Station at the Event</h3>
                                    <p className="text-sm text-muted-foreground">
                                        On Feb 4th, we'll assign you a date! You'll coordinate a time to meet and connect. No match? No worries! You can always mingle at the event.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Header / Flyer Section */}

                    <h2 className="text-2xl font-bold">Sign Up</h2>
                    <Card className="overflow-hidden border-2 border-violet-100 dark:border-violet-900 shadow-xl">
                        <div className="grid md:grid-cols-2 gap-0">
                            <div className="relative h-[400px] md:h-auto bg-black">
                                <img
                                    src={FlyerImage}
                                    alt="Event Flyer"
                                    className="object-contain w-full h-full"
                                />
                            </div>
                            <div className="p-8 flex flex-col justify-center space-y-6">
                                <div>
                                    <h3 className="text-2xl font-bold mb-2">Event Details</h3>
                                    <div className="space-y-3 text-lg">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="w-5 h-5 text-violet-500" />
                                            <span>February 5th, 2026 @ 23:00</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <MapPin className="w-5 h-5 text-violet-500" />
                                            <span>Plaza Klub<br />Badenerstrasse 109, 8004 Zurich</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-6">
                                    <h3 className="text-xl font-semibold mb-4">Are you going?</h3>
                                    <Button
                                        size="lg"
                                        className={`w-full text-lg ${isEnrolled
                                            ? "border-red-600 border-2 text-red-600 hover:bg-red-200 from-white to-white"
                                            : "bg-linear-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 shadow-lg shadow-violet-500/20"
                                            }`}
                                        onClick={toggleEnrollment}
                                        disabled={enrolling}
                                    >
                                        {enrolling ? (
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        ) : isEnrolled ? (
                                            "Unregister"
                                        ) : (
                                            "Count me in!"
                                        )}
                                    </Button>
                                    <p className="text-sm text-muted-foreground text-center mt-3">
                                        {isEnrolled ? "You are on the list!" : "Join others from Orbiit at this event"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Roster Section */}
                    {SHOW_ROSTER && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Users className="w-6 h-6 text-violet-500" />
                                <h2 className="text-2xl font-bold">Who's Going ({enrollments.length})</h2>
                            </div>

                            <Card>
                                <CardContent className="p-0">
                                    {loading ? (
                                        <div className="p-8 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                                        </div>
                                    ) : enrollments.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            Be the first one to join!
                                        </div>
                                    ) : (
                                        <div className="max-h-[400px] overflow-y-auto">
                                            <table className="w-full">
                                                <thead className="bg-muted/50 sticky top-0">
                                                    <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                        <th className="px-6 py-3">User</th>
                                                        <th className="px-6 py-3">Joined</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {enrollments.map((entry) => (
                                                        <tr key={entry.user_id}>
                                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                                                                <span className="font-sans font-medium">Anonymous Orbiit User :)</span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                                {new Date(entry.created_at).toLocaleDateString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}


                </div>
                <Footer className="bg-linear-to-r from-violet-500 to-fuchsia-500" />
            </div >
        </>
    );
};

export default Event;
