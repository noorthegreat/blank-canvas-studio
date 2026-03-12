import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Step, Question } from "@/hooks/use-questions";

interface QuestionSidebarProps {
    steps: Step[];
    currentQuestionIndex: number;
    answers: Record<number, string>;
    answersCustom: Record<number, string>;
    onJumpToQuestion: (index: number) => void;
    shouldShowStep: (index: number) => boolean;
    isLoading: boolean;
}

export const QuestionSidebar = ({
    steps,
    currentQuestionIndex,
    answers,
    answersCustom,
    onJumpToQuestion,
    shouldShowStep,
    isLoading
}: QuestionSidebarProps) => {
    const isQuestionAnswered = (q: Question) => {
        const value = answers[q.id];
        if (!value || value.trim().length === 0) {
            return Boolean(q.multiSelect && q.minResponses === 0);
        }
        return true;
    };

    const shouldShowQuestion = (question: Question) => {
        if (!question.showIf) return true;
        return answers[question.showIf.questionId] === question.showIf.answer;
    };

    const visibleStepIndices = steps
        .map((_, index) => index)
        .filter((index) => shouldShowStep(index));

    const stepDisplayNumbers = new Map<number, number>();
    visibleStepIndices.forEach((stepIndex, displayIndex) => {
        stepDisplayNumbers.set(stepIndex, displayIndex + 1);
    });

    const totalQuestions = visibleStepIndices.length;
    const answeredCount = visibleStepIndices.reduce((count, stepIndex) => {
        const step = steps[stepIndex];
        const qs = (step.type === "combined" ? step.questions : [step.question]).filter((q) => shouldShowQuestion(q));
        const isStepAnswered = qs.length > 0 && qs.every((q) => isQuestionAnswered(q));

        return count + (isStepAnswered ? 1 : 0);
    }, 0);

    return (
        <div className="flex flex-col h-full">
            <CardHeader className="pb-4 shrink-0 px-0 pt-0">
                <CardTitle className="text-xl font-bold">Questions</CardTitle>
                <CardDescription>
                    {answeredCount} of {totalQuestions} answered
                </CardDescription>
            </CardHeader>
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {steps.map((step, index) => {
                    if (!shouldShowStep(index)) return null;

                    const qs = (step.type === 'combined' ? step.questions : [step.question]).filter(q => shouldShowQuestion(q));
                    const isAnswered = qs.length > 0 && qs.every(q => isQuestionAnswered(q));
                    const isActive = currentQuestionIndex === index;
                    const isSkipped = qs.length > 0 && qs.every(q => answers[q.id] === 'Skip');
                    const label = step.type === 'combined' ? "Basics" : step.question.question;
                    const displayNumber = stepDisplayNumbers.get(index) ?? (index + 1);

                    return (
                        <div
                            key={`step-${index}`}
                            onClick={() => !isLoading && onJumpToQuestion(index)}
                            className={cn(
                                "p-3 rounded-lg text-sm cursor-pointer transition-colors border",
                                isActive
                                    ? "bg-primary/10 border-primary text-primary font-medium"
                                    : "hover:bg-muted border-transparent text-muted-foreground hover:text-foreground",
                                isAnswered && !isActive ? "bg-muted/30" : ""
                            )}
                        >
                            <div className="flex items-start gap-2">
                                <div className={cn(
                                    "mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border shrink-0",
                                    isAnswered ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground",
                                    isActive && "border-primary"
                                )}>
                                    {isAnswered && <Check className="w-2.5 h-2.5" />}
                                </div>
                                <div className="flex-1 line-clamp-2">
                                    <span className="mr-1">{displayNumber}.</span>
                                    {label}
                                </div>
                            </div>
                            {isAnswered && step.type === 'single' && (
                                <div className="ml-6 mt-1 text-xs text-muted-foreground line-clamp-1 italic">
                                    {answersCustom[step.question.id] ? answersCustom[step.question.id] : (isSkipped ? "Skipped" :
                                        answers[step.question.id].split(',').map(val => {
                                            if (val.trim().startsWith('CUSTOM')) return 'Other';
                                            const option = step.question.options?.find(o => o.value === val.trim());
                                            return option ? option.label : val;
                                        }).join(', ')
                                    )}
                                </div>
                            )}
                            {isAnswered && step.type === 'combined' && (
                                <div className="ml-6 mt-1 text-xs text-muted-foreground line-clamp-1 italic">
                                    {isSkipped ? "Skipped" : "Completed"}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
