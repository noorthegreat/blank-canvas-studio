
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type DateType = {
    id: string;
    matched_user: {
        first_name: string;
    };
    user1_id: string;
    user2_id: string;
    user1_followup_preference: "match" | "friend" | "pass" | null;
    user2_followup_preference: "match" | "friend" | "pass" | null;
};

interface DateFeedbackDialogProps {
    date: DateType | null;
    isOpen: boolean;
    onClose: () => void;
    currentUserId: string | null;
}

export const DateFeedbackDialog = ({ date, isOpen, onClose, currentUserId }: DateFeedbackDialogProps) => {
    const { toast } = useToast();
    const [questions, setQuestions] = useState<any[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [preference, setPreference] = useState<"match" | "friend" | "pass" | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const areAllQuestionsAnswered = questions.every((q) => (answers[q.id] || "").trim().length > 0);
    const isFormValid = !!preference && areAllQuestionsAnswered;

    useEffect(() => {
        if (isOpen && date && currentUserId) {
            // Load questions and existing answers
            loadQuestionsAndAnswers();

            // Set initial preference
            const existingPref = date.user1_id === currentUserId
                ? date.user1_followup_preference
                : date.user2_followup_preference;
            setPreference(existingPref);
        } else {
            // Reset state when closed
            setAnswers({});
            setPreference(null);
        }
    }, [isOpen, date, currentUserId]);

    const loadQuestionsAndAnswers = async () => {
        setIsLoadingQuestions(true);
        try {
            // Load active questions
            // @ts-ignore
            const { data: qs, error: qError } = await (supabase as any)
                .from("date_feedback_questions")
                .select("*")
                .eq("is_active", true)
                .order("created_at", { ascending: true });

            if (qError) throw qError;
            setQuestions(qs || []);

            // Load existing answers if any
            // @ts-ignore
            const { data: ans, error: aError } = await (supabase as any)
                .from("date_feedback_answers")
                .select("question_id, answer")
                .eq("date_id", date?.id)
                .eq("user_id", currentUserId);

            if (aError) throw aError;

            const ansMap: Record<string, string> = {};
            ans?.forEach((a: any) => {
                ansMap[a.question_id] = a.answer;
            });
            setAnswers(ansMap);

        } catch (error) {
            console.error("Error loading feedback data:", error);
        } finally {
            setIsLoadingQuestions(false);
        }
    };

    const handleSubmit = async () => {
        if (!date || !currentUserId) return;
        if (!isFormValid) {
            toast({
                title: "Missing required answers",
                description: "Please select an interest level and answer all feedback questions.",
                variant: "destructive",
            });
            return;
        }
        setIsSubmitting(true);

        try {
            // 1. Update preference on dates table
            const preferenceField = date.user1_id === currentUserId ? "user1_followup_preference" : "user2_followup_preference";

            const { error: prefError } = await supabase
                .from("dates")
                .update({ [preferenceField]: preference })
                .eq("id", date.id);

            if (prefError) throw prefError;

            // 2. Save answers to date_feedback_answers
            // We need to upsert answers. 
            // Since we don't have a unique constraint on (date_id, question_id, user_id) in the migration (Wait, I should have added one!),
            // we will delete existing answers for this user/date and re-insert. 
            // Or better, check if exists.

            // Simpler approach for now: Delete all answers for this user/date and re-insert.
            // @ts-ignore
            await (supabase as any)
                .from("date_feedback_answers")
                .delete()
                .eq("date_id", date.id)
                .eq("user_id", currentUserId);

            const answersToInsert = Object.entries(answers)
                .filter(([_, val]) => val.trim() !== "")
                .map(([qId, val]) => ({
                    date_id: date.id,
                    question_id: qId,
                    user_id: currentUserId,
                    answer: val
                }));

            if (answersToInsert.length > 0) {
                // @ts-ignore
                const { error: ansError } = await (supabase as any)
                    .from("date_feedback_answers")
                    .insert(answersToInsert);

                if (ansError) throw ansError;
            }

            toast({
                title: "Feedback submitted",
                description: "Thank you for your feedback!",
            });
            onClose();
        } catch (error: any) {
            console.error("Error submitting feedback:", error);
            toast({
                title: "Error",
                description: "Could not submit feedback.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!date) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Date Feedback</DialogTitle>
                    <DialogDescription>
                        How was your date with {date.matched_user.first_name}? This feedback is private and won't be shared with your match!
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    {/* Interest Level Section */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Interest Level</Label>
                            <div className="flex gap-2">
                            <Button
                                variant={preference === "match" ? "default" : "outline"}
                                className={cn("flex-1 transition-all", preference === "match" && "bg-pink-500 hover:bg-pink-600 border-pink-500 text-white")}
                                onClick={() => setPreference("match")}
                            >
                                ❤️ Match
                            </Button>
                            <Button
                                variant={preference === "friend" ? "default" : "outline"}
                                className={cn("flex-1 transition-all", preference === "friend" && "bg-blue-500 hover:bg-blue-600 border-blue-500 text-white")}
                                onClick={() => setPreference("friend")}
                            >
                                🤝 Friend
                            </Button>
                            <Button
                                variant={preference === "pass" ? "default" : "outline"}
                                className={cn("flex-1 transition-all", preference === "pass" && "bg-gray-500 hover:bg-gray-600 border-gray-500 text-white")}
                                onClick={() => setPreference("pass")}
                            >
                                👋 Pass
                            </Button>
                            </div>
                        <p className="text-xs text-muted-foreground">Required</p>
                    </div>

                    <div className="space-y-4">
                        {isLoadingQuestions ? (
                            <p className="text-sm text-muted-foreground">Loading questions...</p>
                        ) : questions.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No additional questions.</p>
                        ) : (
                            questions.map((q) => (
                                <div key={q.id} className="space-y-2">
                                    <Label htmlFor={q.id} className="text-base font-semibold">
                                        {q.question} <span className="text-destructive">*</span>
                                    </Label>
                                    <Textarea
                                        id={q.id}
                                        placeholder="Required"
                                        value={answers[q.id] || ""}
                                        onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                        rows={3}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        All answers are private and only visible to Orbiit staff, and will be used to improve our algorithm :)
                    </p>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || isLoadingQuestions || !isFormValid}>
                        {isSubmitting ? "Submitting..." : "Submit Feedback"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
