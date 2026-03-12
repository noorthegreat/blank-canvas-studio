import { useNavigate } from "react-router-dom";
import { Clock, Loader2, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import FlyerImage from "@/assets/match_lab_flyer.jpeg";

/**
 * Event Banner component 
 * Wraps the promotional banner for the current event.
 */
const EventBanner = ({ variant = 'default', onEnrollmentChange }: { variant?: 'default' | 'public', onEnrollmentChange?: (isEnrolled: boolean) => void }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [enrolling, setEnrolling] = useState(false);
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [sessionUser, setSessionUser] = useState<any>(null);

    const EVENT_NAME = "match_lab_plaza_feb_05";

    useEffect(() => {
        if (variant === 'default') {
            checkSession();
        }
    }, [variant]);

    const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setSessionUser(session.user);
            checkEnrollmentStatus(session.user.id);
        }
    };

    const checkEnrollmentStatus = async (userId: string) => {
        setLoading(true);
        const { data, error } = await supabase
            .from("event_enrollments")
            .select("*")
            .eq("user_id", userId)
            .eq("event_name", EVENT_NAME)
            .maybeSingle();

        if (!error && data) {
            setIsEnrolled(true);
        }
        setLoading(false);
    };

    const toggleEnrollment = async (checked: boolean) => {
        if (!sessionUser) {
            navigate("/auth");
            return;
        }

        setEnrolling(true);

        try {
            if (!checked) {
                // Unenroll
                const { error } = await supabase
                    .from("event_enrollments")
                    .delete()
                    .eq("user_id", sessionUser.id)
                    .eq("event_name", EVENT_NAME);

                if (error) throw error;

                setIsEnrolled(false);
                onEnrollmentChange?.(false);
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
                onEnrollmentChange?.(true);
                toast({
                    title: "You're going!",
                    description: "See you at the Match Lab!",
                });
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
            // Revert state if error
            setIsEnrolled(!checked);
        } finally {
            setEnrolling(false);
        }
    };
    if (variant == "public") {
        return (<div
            onClick={() => navigate("/auth", { state: { isSignIn: false } })}
            className={`mb-8 relative overflow-hidden rounded-xl border-2 border-violet-500/50 hover:border-violet-500 transition-all shadow-lg hover:shadow-violet-500/20 group w-full bg-linear-to-r from-violet-900/40 to-fuchsia-900/40`}
        >
            <div className="flex flex-col-reverse md:flex-row items-center">
                {/* Image Section */}
                <div className="md:w-1/3 relative min-h-[200px] md:min-h-[250px] m-2 ">
                    <img
                        src={FlyerImage}
                        alt="Event Flyer"
                        className="rounded"
                    />
                </div>

                {/* Content Section */}
                <div className="flex-1 relative p-6 flex flex-col justify-center">

                    <div className="relative z-10 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="bg-violet-500 text-white text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                New Event
                            </span>
                            <span className="text-violet-200 text-sm font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Feb 5th @ 22:00
                            </span>
                        </div>

                        <h3 className="text-2xl md:text-3xl font-bold text-white group-hover:text-violet-100 transition-colors">
                            Orbiit <span className="text-violet-300">×</span> Match Lab
                        </h3>

                        <div className="flex items-center gap-2 text-violet-200 text-sm">
                            <MapPin className="w-4 h-4" /> Plaza Klub, Zurich
                        </div>

                        <p className="text-gray-300 max-w-lg">
                            Join us for a special matchmaking event! Sign up for Orbiit to get on the guest list.
                        </p>
                    </div>
                </div>
            </div>
        </div>)
    }
    else {
        return (
            <div
                onClick={() => navigate("/event")}
                className={`mb-8 relative overflow-hidden rounded-xl border-2 border-violet-500/50 hover:border-violet-500 transition-all shadow-lg hover:shadow-violet-500/20 group w-full cursor-pointer`}
            >
                <div className="absolute inset-0 bg-linear-to-r from-violet-900/90 to-fuchsia-900/90 z-10" />
                <div className="absolute inset-0 bg-[url('@/assets/match_lab_flyer.jpeg')] bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity z-0" />

                <div className="relative z-20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-violet-500 text-white text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                New Event
                            </span>
                            <span className="text-violet-200 text-sm font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Feb 5th
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold text-white group-hover:text-violet-100 transition-colors">
                            Orbiit <span className="text-violet-300">×</span> Match Lab <span className="text-violet-300">×</span> Plaza
                        </h3>
                        <p className="text-violet-200">
                            Join us to get a date for a special event in Zurich! Click to see the flyer and enroll!
                        </p>
                    </div>

                    <div
                        className="flex items-center gap-3 bg-black/40 hover:bg-black/50 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 transition-all shadow-xl z-30"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col items-end">
                            <span className={`text-sm font-bold transition-colors ${isEnrolled ? "text-white" : "text-white/70"}`}>
                                {isEnrolled ? "I'm Going!" : "Are you going?"}
                            </span>
                        </div>
                        {loading || enrolling ? (
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                        ) : (
                            <Switch
                                checked={isEnrolled}
                                onCheckedChange={toggleEnrollment}
                                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-white/20 border-2 border-transparent"
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    }
};

export default EventBanner;

