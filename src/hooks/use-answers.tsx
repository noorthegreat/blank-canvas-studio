import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

// only does custom answers for now for displaying in profile, can extend later
const useAnswers = () => {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [answersCustom, setAnswersCustom] = useState<Record<number, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        return;
      }
      supabase
        .from("personality_answers")
        .select("*")
        .eq("user_id", session.user.id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const existingAnswers: Record<number, string> = {};
            const existingAnswersCustom: Record<number, string> = {};

            data.forEach(a => {
              existingAnswers[a.question_number] = a.answer;
              existingAnswersCustom[a.question_number] = a.answer_custom;
            });
            setAnswers(existingAnswers);
            setAnswersCustom(existingAnswersCustom)
          }
        });
    });
  }, []);
  return { answers, answersCustom }
};

export default useAnswers;