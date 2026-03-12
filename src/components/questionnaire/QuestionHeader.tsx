import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface QuestionHeaderProps {
    currentQuestionIndex: number;
    totalQuestions: number;
    onNext: () => void;
    onPrev: () => void;
    onSubmit: () => void;
    onSkip?: () => void;
    isTestUser: boolean;
    isLoading: boolean;
    canGoNext: boolean;
    canGoPrev: boolean;
    currentDefaultAnswer?: string;
    title?: string;
}

export const QuestionHeader = ({
    currentQuestionIndex,
    totalQuestions,
    onNext,
    onPrev,
    onSubmit,
    onSkip,
    isTestUser,
    isLoading,
    canGoNext,
    canGoPrev,
    currentDefaultAnswer,
    title = "Compatibility Survey"
}: QuestionHeaderProps) => {
    const progress = currentQuestionIndex >= 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0;
    const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

    return (
        <CardHeader>
            <CardTitle className="text-2xl font-bold text-orbiit">
                <div className="flex justify-between">
                    <Button
                        variant="outline"
                        onClick={onPrev}
                        disabled={!canGoPrev}
                    >
                        Previous
                    </Button>

                    <span className="md:block hidden text-center">
                        {title}
                    </span>

                    {!isLastQuestion ? (
                        <Button
                            onClick={onNext}
                            disabled={!canGoNext}
                            variant="outline"
                            className=""
                        >
                            Next
                        </Button>
                    ) : (
                        <Button
                            onClick={onSubmit}
                            disabled={!canGoNext || isLoading} // Reusing canGoNext as 'canSubmit' effectively
                            className="bg-linear-to-r from-backgrounda to-backgroundc hover:opacity-90 transition-opacity"
                        >
                            {isLoading ? "Saving answers..." : "Complete"}
                        </Button>
                    )}
                </div>
            </CardTitle>
            {currentQuestionIndex >= 0 && (
                <>
                    {isTestUser && onSkip && (
                        <Button
                            onClick={onSkip}
                            variant="outline"
                            disabled={isLoading}
                            className=" bg-yellow-500/50"
                        >
                            Skip Answer with default: {currentDefaultAnswer}
                        </Button>
                    )}
                    <CardDescription>
                        Question {currentQuestionIndex + 1} of {totalQuestions}
                    </CardDescription>
                    <Progress value={progress} className="h-2 [&>div]:bg-orbiit" />
                </>
            )}
        </CardHeader>
    );
};
