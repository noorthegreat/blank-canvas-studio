import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import { useQuestions, Question } from "@/hooks/use-questions";
import { QuestionHeader } from "@/components/questionnaire/QuestionHeader";
import EventBanner from "@/components/EventBanner";
import Footer from "./Footer";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Circle } from "lucide-react";

const getDefaultAnswer = (q: Question | undefined): string => {
    if (!q) return "";
    if (q.defaultAnswer) {
        return "CUSTOM";
    } else if (q.rangeSlider) {
        return `${q.defaultRange?.[0] || 0}:${q.defaultRange?.[1] || 100}`;
    } else if (q.multiSelect) {
        const numToSelect = q.minResponses || 1;
        const selected = q.options.slice(0, numToSelect).map(opt => opt.value);
        return selected.join(',');
    } else if (q.ranked) {
        return q.options.map(opt => opt.value).join(',');
    } else {
        return q.options[0]?.value || "";
    }
};

const QuestionnaireIntro = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const { questions, isLoading: isQuestionsLoading } = useQuestions();
    const [isLoading, setIsLoading] = useState(false);
    const [isTestUser, setIsTestUser] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) {
                navigate("/auth");
                return;
            }
            setUser(session.user);

            // Check if user has test role from database
            const { data: hasTestRole } = await supabase.rpc('has_role', {
                _user_id: session.user.id,
                _role: 'test'
            });

            const { data: hasAdminRole } = await supabase.rpc('has_role', {
                _user_id: session.user.id,
                _role: 'admin'
            });

            if (hasTestRole || hasAdminRole) {
                setIsTestUser(true);
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("completed_questionnaire, completed_friendship_questionnaire")
                .eq("id", session.user.id)
                .maybeSingle();

            if (profile) {
                setUserProfile(profile);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!session) {
                navigate("/auth");
            } else {
                setUser(session.user);
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    const shouldShowQuestion = (questionIndex: number, currentAnswers: Record<number, string>): boolean => {
        const question = questions[questionIndex];
        if (!question.showIf) return true;

        const dependentAnswer = currentAnswers[question.showIf.questionId];
        return dependentAnswer === question.showIf.answer;
    };

    const handleSkipQuestionnaire = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const defaultAnswers: Record<number, string> = {};
            // We need to simulate the flow to determine which questions to show/answer
            // This is a simplified version assuming defaults don't trigger complex showIf logic changes that contradict the default path
            // A more robust way would be to iterate.

            // First pass: gather defaults for everything (simplified) or iterate?
            // Let's iterate linearly.
            for (let i = 0; i < questions.length; i++) {
                if (shouldShowQuestion(i, defaultAnswers)) {
                    defaultAnswers[questions[i].id] = getDefaultAnswer(questions[i]);
                }
            }

            const answerRecords = Object.entries(defaultAnswers).map(([questionNum, answer]) => {
                return {
                    user_id: user.id,
                    question_number: parseInt(questionNum),
                    answer: answer
                };
            });

            const { error: answersError } = await supabase
                .from("personality_answers")
                .upsert(answerRecords);

            if (answersError) throw answersError;

            const { error: profileError } = await supabase
                .from("profiles")
                .update({ completed_questionnaire: true })
                .eq("id", user.id);

            if (profileError) throw profileError;

            toast({
                title: "Questionnaire skipped!",
                description: "Default answers submitted. Let's add your profile details!",
            });

            navigate("/profile-setup");
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (isQuestionsLoading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    return (
        <>
            <div className="min-h-screen bg-transparent p-4 py-8 flex flex-col items-center gap-10">
                <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">Welcome to Orbiit!</h1>
                    <p className="text-lg md:text-xl text-white">Select a questionnaire to get started</p>
                </div>

                {/* <div className="w-full max-w-4xl mx-auto">
                    <EventBanner />
                </div> */}

                <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl mx-auto items-stretch">

                    {/* Romance Survey Card */}
                    <Card className="relative flex-1 shadow-xl border-border/50 hover:shadow-2xl hover:scale-[1.01] transition-all duration-200 cursor-pointer" onClick={() => navigate("/questionnaire/romance")}>
                        <div className="absolute top-4 right-4 z-10">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div>
                                            {userProfile?.completed_questionnaire ? (
                                                <CheckCircle2 className="w-8 h-8 text-pink-500 fill-pink-100" />
                                            ) : (
                                                <Circle className="w-8 h-8 text-pink-200" />
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{userProfile?.completed_questionnaire ? "You've completed this survey" : "Not yet completed"}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <CardContent className="flex flex-col items-center justify-center h-full p-8 space-y-6 text-center pt-12">
                            <div className="p-4 rounded-full bg-pink-100 text-pink-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-pink-500">Compatibility Survey</h3>
                                <p className="text-muted-foreground">Find your perfect romantic match through our scientific compatibility analysis.</p>
                            </div>
                            <Button className="w-full bg-linear-to-r from-pink-500 to-rose-500 hover:opacity-90">
                                Find a Date
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Friendship Survey Card */}
                    <Card className="relative flex-1 shadow-xl border-border/50 hover:shadow-2xl hover:scale-[1.01] transition-all duration-200 cursor-pointer" onClick={() => navigate("/questionnaire/friendship")}>
                        <div className="absolute top-4 right-4 z-10">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div>
                                            {userProfile?.completed_friendship_questionnaire ? (
                                                <CheckCircle2 className="w-8 h-8 text-blue-500 fill-blue-100" />
                                            ) : (
                                                <Circle className="w-8 h-8 text-blue-200" />
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{userProfile?.completed_friendship_questionnaire ? "You've completed this survey" : "Not yet completed"}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <CardContent className="flex flex-col items-center justify-center h-full p-8 space-y-6 text-center pt-12">
                            <div className="p-4 rounded-full bg-blue-100 text-blue-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-blue-400">Friendship Survey</h3>
                                <p className="text-muted-foreground">Connect with like-minded people and build lasting friendships.</p>
                            </div>
                            <Button className="w-full bg-linear-to-r from-blue-500 to-cyan-500 hover:opacity-90">
                                Making Friends
                            </Button>
                        </CardContent>
                    </Card>

                </div>

                {isTestUser && (
                    <div className="text-center w-full mt-6 mb-2">
                        <Button
                            onClick={handleSkipQuestionnaire}
                            variant="outline"
                            disabled={isLoading}
                            className="text-muted-foreground bg-yellow-200"
                        >
                            {isLoading ? "Skipping..." : "Skip Questionnaire (Test Mode - Defaults Love)"}
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
};

export default QuestionnaireIntro;
