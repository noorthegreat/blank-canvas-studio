
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QuestionOption {
    value: string;
    label: string;
}

export interface ShowIfCondition {
    questionId: number;
    answer: string;
}

export interface Question {
    id: number;
    question: string;
    options: QuestionOption[];
    maxResponses?: number;
    minResponses?: number;
    multiSelect?: boolean;
    showIf?: ShowIfCondition;
    rangeSlider?: boolean;
    minValue?: number;
    maxValue?: number;
    defaultRange?: number[];
    allowCustom?: boolean;
    hasDropdown?: boolean;
    ranked?: boolean;
    defaultAnswer?: string;
    disabled?: boolean;
    orderIndex?: number;
    combined?: boolean;
}

export type Step =
    | { type: 'combined'; questions: Question[] }
    | { type: 'single'; question: Question };

export const useQuestions = (tableName: "questionnaire_questions" | "friendship_questions" = "questionnaire_questions") => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchQuestions = async () => {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .order('order_index', { ascending: true })
                .order('id', { ascending: true }); // Fallback sorting

            if (error) throw error;

            if (data) {
                const normalizeQuestion = (value: unknown): string =>
                    typeof value === "string" ? value.trim().toLowerCase() : "";

                const parsedQuestions = (data as any[]).map((row) => {
                    const normalizedQuestion = normalizeQuestion(row.question);

                    // Keep Q18 ("Preferred age range for a partner") on the first essential page.
                    // Some environments may have stale `combined` values in DB.
                    const forceCombined =
                        tableName === "questionnaire_questions" &&
                        normalizedQuestion === "preferred age range for a partner";

                    return {
                        id: row.id,
                        question: row.question,
                        options: row.options as unknown as QuestionOption[],
                        minResponses: row.min_responses,
                        maxResponses: row.max_responses,
                        multiSelect: row.multi_select,
                        showIf: row.show_if as unknown as ShowIfCondition,
                        rangeSlider: row.range_slider,
                        minValue: row.min_value,
                        maxValue: row.max_value,
                        defaultRange: row.default_range,
                        allowCustom: row.allow_custom,
                        hasDropdown: row.has_dropdown,
                        ranked: row.ranked,
                        defaultAnswer: row.default_answer,
                        disabled: row.disabled,
                        orderIndex: row.order_index,
                        combined: tableName === "questionnaire_questions"
                            ? (Boolean(row.combined) || forceCombined)
                            : Boolean(row.combined),
                    };
                });

                setAllQuestions(parsedQuestions);
                setQuestions(parsedQuestions.filter((q: Question) => !q.disabled));
            }
        } catch (err: any) {
            console.error("Error fetching questions:", err);
            setError(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestions();
    }, [tableName]);

    const refreshQuestions = () => {
        setIsLoading(true);
        fetchQuestions();
    }

    return { questions, allQuestions, isLoading, error, refreshQuestions };
};
