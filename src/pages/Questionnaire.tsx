import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import { Menu } from "lucide-react";
import { useQuestions, Question } from "@/hooks/use-questions";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import BackgroundImage from "@/assets/bg2.webp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Footer from "./Footer";

// New Components
import { QuestionSidebar } from "@/components/questionnaire/QuestionSidebar";
import {
  RangeSliderQuestion,
  DropdownQuestion,
  MultiSelectQuestion,
  SingleSelectQuestion,
  RankedQuestion
} from "@/components/questionnaire/QuestionInputs";
import { QuestionHeader } from "@/components/questionnaire/QuestionHeader";

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

type Step =
  | { type: 'combined'; questions: Question[] }
  | { type: 'single'; question: Question };

const Questionnaire = () => {
  const navigate = useNavigate();
  const { type } = useParams<{ type: string }>();
  const surveyType = type === 'friendship' ? 'friendship' : 'romance';
  const questionsTable = surveyType === 'friendship' ? 'friendship_questions' : 'questionnaire_questions';
  const answersTable = surveyType === 'friendship' ? 'friendship_answers' : 'personality_answers';
  const completedColumn = surveyType === 'friendship' ? 'completed_friendship_questionnaire' : 'completed_questionnaire';
  const surveyTitle = surveyType === 'friendship' ? 'Friendship Survey' : 'Compatibility Survey';

  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const { questions, isLoading: isQuestionsLoading } = useQuestions(questionsTable);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [answersCustom, setAnswersCustom] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(true);
  const [currentDefaultAnswer, setCurrentDefaultAnswer] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isTestUser, setIsTestUser] = useState(false);
  const [showCombinedNextDialog, setShowCombinedNextDialog] = useState(false);

  // Derive steps from questions
  const combinedQuestions = questions.filter(q => q.combined);
  const singleQuestions = questions.filter(q => !q.combined);

  const steps: Step[] = [];
  if (combinedQuestions.length > 0) {
    steps.push({ type: 'combined', questions: combinedQuestions });
  }
  singleQuestions.forEach(q => steps.push({ type: 'single', question: q }));

  const currentStep = steps[currentQuestion];
  const currentQ = currentStep?.type === 'single' ? currentStep.question : null;

  let currentAnswer = currentQ ? answers[currentQ.id] || "" : "";

  if (currentQ?.defaultAnswer && !currentAnswer && isFirstTimeSetup) {
    currentAnswer = "CUSTOM"
  }

  if (currentQ?.minResponses === 0 && !currentAnswer) {
    answers[currentQ.id] = "Skip";
    currentAnswer = "Skip";
  }
  const currentAnswerArray = currentAnswer ? currentAnswer.split(',') : [];
  const hasCustomAnswer = currentAnswerArray.includes('CUSTOM');
  const customAnswerText = answersCustom[currentQ?.id] || "";

  var howManyToSelectMessage = "";
  var hasRightNumberOfResponses = true;
  if (currentQ?.multiSelect) {
    if (currentQ?.minResponses && currentQ?.minResponses === currentQ?.maxResponses) {
      howManyToSelectMessage = `(Select ${currentQ?.maxResponses})`;
      hasRightNumberOfResponses = currentAnswerArray.length === currentQ?.maxResponses;
    }
    else if (currentQ?.minResponses && currentQ?.maxResponses) {
      howManyToSelectMessage = `(Select between ${currentQ?.minResponses} and ${currentQ?.maxResponses})`;
      hasRightNumberOfResponses = currentAnswerArray.length >= currentQ?.minResponses && currentAnswerArray.length <= currentQ?.maxResponses;
    }
    else if (currentQ?.minResponses) {
      howManyToSelectMessage = `(Select at least ${currentQ?.minResponses})`;
      hasRightNumberOfResponses = currentAnswerArray.length >= currentQ?.minResponses;
    }
    else if (currentQ?.maxResponses) {
      howManyToSelectMessage = `(Select up to ${currentQ?.maxResponses})`;
      hasRightNumberOfResponses = currentAnswerArray.length <= currentQ?.maxResponses;
    } else {
      howManyToSelectMessage = "(Select all that apply)";
    }
  }

  useEffect(() => {
    if (steps.length > 0 && currentQuestion >= 0 && currentQuestion < steps.length) {
      const step = steps[currentQuestion];
      if (step.type === 'single') {
        setCurrentDefaultAnswer(getDefaultAnswer(step.question));
      } else {
        setCurrentDefaultAnswer(""); // No single default for combined
      }
    }
  }, [questions, currentQuestion]);

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

      // Load existing answers
      supabase
        .from(answersTable)
        .select("*")
        .eq("user_id", session.user.id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setIsFirstTimeSetup(false);
            if (steps.length > 0) {
              const step = steps[0];
              if (step.type === 'single') {
                setCurrentDefaultAnswer(getDefaultAnswer(step.question));
              }
            }
            const existingAnswers: Record<number, string> = {};
            const existingAnswersCustom: Record<number, string> = {};

            data.forEach((a) => {
              existingAnswers[a.question_number] = a.answer;
              existingAnswersCustom[a.question_number] = a.answer_custom;
            });
            setAnswers(existingAnswers);
            setAnswersCustom(existingAnswersCustom)
          }
        });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, answersTable, questions]);

  if (isQuestionsLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading questions...</div>;
  }

  const shouldShowQuestion = (q: Question, currentAnswers: Record<number, string> = answers): boolean => {
    if (!q.showIf) return true;

    const dependentAnswer = currentAnswers[q.showIf.questionId];
    return dependentAnswer === q.showIf.answer;
  };

  const shouldShowStep = (stepIndex: number, currentAnswers: Record<number, string> = answers): boolean => {
    const step = steps[stepIndex];
    if (step.type === 'combined') {
      // Combined step is always shown if it exists (usually the first step)
      // You might want to filter the individual questions within it instead
      return true;
    }
    return shouldShowQuestion(step.question, currentAnswers);
  }

  const visibleStepIndices = steps
    .map((_, index) => index)
    .filter((index) => shouldShowStep(index));
  const totalVisibleSteps = visibleStepIndices.length;
  const currentVisibleStepNumber = Math.max(1, visibleStepIndices.indexOf(currentQuestion) + 1);

  const saveCurrentAnswer = async (answerOverrides?: Record<number, string>) => {
    if (!user || currentQuestion < 0 || currentQuestion >= steps.length) return;

    const step = steps[currentQuestion];
    const qsToSave = step.type === 'combined' ? step.questions : [step.question];

    try {
      const payloads = qsToSave.map(q => {
        const answer = answerOverrides && answerOverrides[q.id] !== undefined ? answerOverrides[q.id] : answers[q.id];
        if (answer === undefined) return null;
        return {
          user_id: user.id,
          question_number: q.id,
          answer: answer,
          answer_custom: answersCustom[q.id]
        };
      }).filter(p => p !== null) as any[];

      if (payloads.length === 0) return;

      const { error } = await supabase
        .from(answersTable)
        .upsert(payloads, { onConflict: 'user_id, question_number' });

      if (error) throw error;
      console.log("Saved answers for step", currentQuestion);
    } catch (error) {
      console.error("Error autosaving:", error);
    }
  };

  const isAnswerValid = () => {
    const step = steps[currentQuestion];
    if (!step) return false;

    if (step.type === 'single') {
      const q = step.question;
      const ans = answers[q.id] || "";
      const ansArr = ans ? ans.split(',') : [];
      const hasCustom = ansArr.includes('CUSTOM');
      const customText = answersCustom[q.id] || "";

      let rightNum = true;
      if (q.multiSelect) {
        if (q.minResponses && q.minResponses === q.maxResponses) {
          rightNum = ansArr.length === q.maxResponses;
        }
        else if (q.minResponses && q.maxResponses) {
          rightNum = ansArr.length >= q.minResponses && ansArr.length <= q.maxResponses;
        }
        else if (q.minResponses) {
          rightNum = ansArr.length >= q.minResponses;
        }
        else if (q.maxResponses) {
          rightNum = ansArr.length <= q.maxResponses;
        }
      }

      return !(!ans || !rightNum || (q.id == 1 && ans === 'B') || (hasCustom && customText.length == 0));
    } else {
      // For combined, all *shown* questions must be valid
      return step.questions.every(q => {
        if (!shouldShowQuestion(q, answers)) return true; // Skip if conditionally hidden
        const ans = answers[q.id] || "";
        // Optional multi-selects (minResponses = 0) should not block progress when left empty.
        if (!ans && q.multiSelect && q.minResponses === 0) return true;

        const ansArr = ans ? ans.split(',') : [];
        const hasCustom = ansArr.includes('CUSTOM');
        const customText = answersCustom[q.id] || "";

        let rightNum = true;
        if (q.multiSelect) {
          if (q.minResponses && q.minResponses === q.maxResponses) {
            rightNum = ansArr.length === q.maxResponses;
          }
          else if (q.minResponses && q.maxResponses) {
            rightNum = ansArr.length >= q.minResponses && ansArr.length <= q.maxResponses;
          }
          else if (q.minResponses) {
            rightNum = ansArr.length >= q.minResponses;
          }
          else if (q.maxResponses) {
            rightNum = ansArr.length <= q.maxResponses;
          }
        }

        // Notice we don't apply the q.id == 1 logic unless that ID is actually in here, 
        // but typically combined questions are standard inputs.
        return !(!ans || !rightNum || (q.id == 1 && ans === 'B') || (hasCustom && customText.length == 0));
      });
    }
  };



  const jumpToQuestion = async (index: number) => {
    if (index === currentQuestion) return;

    // Check if the current answer is valid before saving
    if (isAnswerValid()) {
      await saveCurrentAnswer();
    } else {
      toast({
        title: "Answer not saved",
        description: "Heads up - that answer was incomplete or invalid and wasn't saved.",
        variant: "default",
      });
    }

    const step = steps[index];
    if (step && step.type === 'single') {
      setCurrentDefaultAnswer(getDefaultAnswer(step.question));
    } else {
      setCurrentDefaultAnswer("");
    }
    setCurrentQuestion(index);
    setSheetOpen(false);
  };

  const proceedToNextStep = (answersToUse: Record<number, string>) => {
    let nextQuestion = currentQuestion + 1;
    while (nextQuestion < steps.length && !shouldShowStep(nextQuestion, answersToUse)) {
      nextQuestion++;
    }
    if (nextQuestion < steps.length) {
      const nextStep = steps[nextQuestion];
      if (nextStep.type === 'single') {
        setCurrentDefaultAnswer(getDefaultAnswer(nextStep.question));
        if (nextStep.question.defaultAnswer) {
          setAnswers(prev => ({ ...prev, [nextStep.question.id]: 'CUSTOM' }));
        }
      } else {
        setCurrentDefaultAnswer("");
      }
      setCurrentQuestion(nextQuestion);
    }
  };

  const handleNext = async (updatedAnswers?: Record<number, string>) => {
    const answersToUse = updatedAnswers || answers;

    if (currentQuestion < steps.length - 1) {
      await saveCurrentAnswer(updatedAnswers);

      if (steps[currentQuestion].type === 'combined') {
        setShowCombinedNextDialog(true);
        return;
      }

      proceedToNextStep(answersToUse);
    }
  };

  const handlePrevious = async () => {
    if (currentQuestion > 0) {
      await saveCurrentAnswer();
      let prevQuestion = currentQuestion - 1;
      while (prevQuestion >= 0 && !shouldShowStep(prevQuestion)) {
        prevQuestion--;
      }
      if (prevQuestion >= 0) {
        const prevStep = steps[prevQuestion];
        if (prevStep.type === 'single') {
          setCurrentDefaultAnswer(getDefaultAnswer(prevStep.question));
        } else {
          setCurrentDefaultAnswer("");
        }
        setCurrentQuestion(prevQuestion);
      }
    }
  };

  const handleAnswerChange = (questionId: number, value: string) => {
    console.log("handlingAnswerChange:", value)
    const currentQ = questions.find(q => q.id === questionId);
    if (!currentQ) return;

    if (currentQ.multiSelect) {
      const currentAnswers = answers[currentQ.id] ? answers[currentQ.id].split(',') : [];
      const index = currentAnswers.indexOf(value);

      if (index > -1) {
        currentAnswers.splice(index, 1);
        if (value == 'CUSTOM') {
          setAnswersCustom(prev => ({ ...prev, [currentQ.id]: "" }));
        }
      } else {
        currentAnswers.push(value);
      }

      if (currentQ.minResponses === 0) {
        const skipIndex = currentAnswers.indexOf('Skip')
        if (skipIndex != -1) {
          if (currentAnswers.length > 1) {
            currentAnswers.splice(skipIndex, 1)
          }
        } else {
          if (currentAnswers.length == 0) {
            currentAnswers.push('Skip')
          }
        }
      }

      setAnswers({
        ...answers,
        [currentQ.id]: currentAnswers.sort().join(',')
      });
    } else {
      const newAnswers = {
        ...answers,
        [currentQ.id]: value
      };
      setAnswers(newAnswers);
      if (value !== 'CUSTOM') {
        setAnswersCustom(prev => ({ ...prev, [currentQ.id]: "" }));

        // Automatically move to next question for single choice questions
        // A question is considered single select if it isn't ranked, multiselect, hasdropdown, or rangeslider
        // ONLY if we are in a single step
        if (steps[currentQuestion]?.type === 'single') {
          if (!currentQ.multiSelect && !currentQ.hasDropdown && !currentQ.ranked && !currentQ.rangeSlider) {
            setTimeout(() => handleNext(newAnswers), 300);
          }
        }
      }
    }
  };

  const handleRankedAnswerChange = (questionId: number, rankedValues: string[]) => {
    const currentQ = questions.find(q => q.id === questionId);
    if (!currentQ) return;
    setAnswers({
      ...answers,
      [currentQ.id]: rankedValues.join(',')
    });
  };

  const handleRangeSliderChange = (questionId: number, values: number[]) => {
    const currentQ = questions.find(q => q.id === questionId);
    if (!currentQ) return;
    setAnswers({
      ...answers,
      [currentQ.id]: `${values[0]}:${values[1]}`
    });
  };

  const handleCustomAnswerChange = (questionId: number, text: string) => {
    const currentQ = questions.find(q => q.id === questionId);
    if (!currentQ) return;
    setAnswersCustom({
      ...answersCustom,
      [currentQ.id]: text
    });
  };

  const handleSkipQuestion = async () => {
    if (!user || currentQuestion < 0 || currentQuestion >= steps.length) return;

    const step = steps[currentQuestion];
    const qsToSkip = step.type === 'combined' ? step.questions : [step.question];

    const newAnswers = { ...answers };
    const newAnswersCustom = { ...answersCustom };
    const payloads = [];

    for (const q of qsToSkip) {
      let defaultAnswer = getDefaultAnswer(q);
      let defaultAnswerCustom = q?.defaultAnswer;

      newAnswers[q.id] = defaultAnswer;
      newAnswersCustom[q.id] = defaultAnswerCustom || "";

      payloads.push({
        user_id: user.id,
        question_number: q.id,
        answer: defaultAnswer,
        answer_custom: defaultAnswerCustom
      });
    }

    setAnswers(newAnswers);
    setAnswersCustom(newAnswersCustom);

    try {
      await supabase.from(answersTable).upsert(payloads, { onConflict: 'user_id, question_number' });
    } catch (e) { console.error("Error saving skip", e) }

    if (currentQuestion < steps.length - 1) {
      let nextQuestion = currentQuestion + 1;
      while (nextQuestion < steps.length && !shouldShowStep(nextQuestion)) {
        nextQuestion++;
      }

      if (nextQuestion < steps.length) {
        const nextStep = steps[nextQuestion];
        if (nextStep.type === 'single') {
          setCurrentDefaultAnswer(getDefaultAnswer(nextStep.question));
        } else {
          setCurrentDefaultAnswer("");
        }
        setCurrentQuestion(nextQuestion);
      } else {
        await handleSubmit();
      }
    } else {
      await handleSubmit();
    }
  };



  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Missing user!",
        description: "Please sign out and sign back in!",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    await saveCurrentAnswer();

    try {
      const answerRecords = Object.entries(answers).map(([questionNum, answer]) => {
        return {
          user_id: user.id,
          question_number: parseInt(questionNum),
          answer: answer,
          answer_custom: answersCustom[parseInt(questionNum)]
        };
      });

      const { error: answersError } = await supabase
        .from(answersTable)
        .upsert(answerRecords, { onConflict: 'user_id, question_number' });
      if (answersError) throw answersError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ [completedColumn]: true })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast({
        title: "Survey complete!",
        description: "Let's add your profile details!",
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



  return (
    <>
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col md:flex-row gap-6 p-4 py-8">
          {/* Mobile Sidebar Toggle */}
          <div className="md:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg bg-background border-primary">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] sm:w-[400px]">
                <QuestionSidebar
                  steps={steps}
                  currentQuestionIndex={currentQuestion}
                  answers={answers}
                  answersCustom={answersCustom}
                  onJumpToQuestion={jumpToQuestion}
                  shouldShowStep={shouldShowStep}
                  isLoading={isLoading}
                />
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Sidebar */}
          <div className="hidden md:block w-96">
            <Card className="h-[calc(100vh-8rem)] overflow-hidden flex flex-col shadow-xl border-border/50">
              <CardContent className="flex-1 p-6 overflow-hidden flex flex-col">
                <QuestionSidebar
                  steps={steps}
                  currentQuestionIndex={currentQuestion}
                  answers={answers}
                  answersCustom={answersCustom}
                  onJumpToQuestion={jumpToQuestion}
                  shouldShowStep={shouldShowStep}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Card className="w-full shadow-xl border-border/50 min-h-[34rem]">

            <QuestionHeader
              currentQuestionIndex={currentVisibleStepNumber - 1}
              totalQuestions={totalVisibleSteps}
              onNext={() => handleNext()}
              onPrev={handlePrevious}
              onSubmit={handleSubmit}
              onSkip={handleSkipQuestion}
              isTestUser={isTestUser}
              isLoading={isLoading}
              canGoNext={isAnswerValid()}
              canGoPrev={currentQuestion > 0}
              currentDefaultAnswer={currentDefaultAnswer}
              title={surveyTitle}
            />
            <CardContent className="space-y-6 min-h-[22rem]">
              {currentStep && (
                <div className="space-y-6">
                  {(currentStep.type === 'combined' ? currentStep.questions : [currentStep.question]).map((q) => {
                    const ans = answers[q.id] || "";
                    const ansArr = ans ? ans.split(',') : [];
                    const hasCust = ansArr.includes('CUSTOM');
                    const custText = answersCustom[q.id] || "";

                    let howManyToSelectMsg = "";
                    if (q.multiSelect) {
                      if (q.minResponses && q.minResponses === q.maxResponses) {
                        howManyToSelectMsg = `(Select ${q.maxResponses})`;
                      }
                      else if (q.minResponses && q.maxResponses) {
                        howManyToSelectMsg = `(Select between ${q.minResponses} and ${q.maxResponses})`;
                      }
                      else if (q.minResponses) {
                        howManyToSelectMsg = `(Select at least ${q.minResponses})`;
                      }
                      else if (q.maxResponses) {
                        howManyToSelectMsg = `(Select up to ${q.maxResponses})`;
                      }
                    }

                    return (
                      <div key={q.id}>
                        <h3 className="text-sm font-semibold mb-1 ">
                          {q.question}
                          {q.multiSelect && (
                            <span className="text-sm font-normal text-muted-foreground ml-2">
                              {howManyToSelectMsg}
                            </span>
                          )}
                        </h3>

                        {q.rangeSlider ? (
                          <RangeSliderQuestion
                            question={q}
                            currentAnswer={ans}
                            onChange={(vals) => handleRangeSliderChange(q.id, vals)}
                          />
                        ) : q.hasDropdown ? (
                          <DropdownQuestion
                            question={q}
                            currentAnswer={ans}
                            onChange={(val) => handleAnswerChange(q.id, val)}
                            customAnswerText={custText}
                            onCustomChange={(txt) => handleCustomAnswerChange(q.id, txt)}
                            hasCustomAnswer={hasCust}
                          />
                        ) : q.ranked ? (
                          <RankedQuestion
                            question={q}
                            currentAnswer={ans}
                            onChange={(vals) => handleRankedAnswerChange(q.id, vals)}
                          />
                        ) : q.multiSelect ? (
                          <MultiSelectQuestion
                            question={q}
                            currentAnswerArray={ansArr}
                            onChange={(val) => handleAnswerChange(q.id, val)}
                            customAnswerText={custText}
                            onCustomChange={(txt) => handleCustomAnswerChange(q.id, txt)}
                            hasCustomAnswer={hasCust}
                          />
                        ) : (
                          <SingleSelectQuestion
                            question={q}
                            currentAnswer={ans}
                            onChange={(val) => handleAnswerChange(q.id, val)}
                            customAnswerText={custText}
                            onCustomChange={(txt) => handleCustomAnswerChange(q.id, txt)}
                            showInputBox={ans === 'CUSTOM'}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showCombinedNextDialog} onOpenChange={setShowCombinedNextDialog}>
        <DialogContent className="border-none rounded-2xl " style={{ backgroundImage: `url(${BackgroundImage})` }}>
          <DialogHeader className="text-white">
            <DialogTitle>Next Steps</DialogTitle>
            <DialogDescription className="text-white">
              You have completed the essential questions. You can now save your answers and continue to edit your profile, or answer more detailed questions in the questionnaire to improve your matches.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="glass" onClick={() => handleSubmit()}>
              Submit & Go to Profile
            </Button>
            <Button variant="glass" className="bg-blue-200/30" onClick={() => {
              setShowCombinedNextDialog(false);
              proceedToNextStep(answers);
            }}>
              Continue Questionnaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </>
  );
};

export default Questionnaire;
