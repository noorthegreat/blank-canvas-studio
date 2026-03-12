CREATE TABLE IF NOT EXISTS public.date_feedback_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.date_feedback_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date_id UUID NOT NULL REFERENCES public.dates(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.date_feedback_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.date_feedback_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_feedback_answers ENABLE ROW LEVEL SECURITY;

-- Questions: Everyone can read active questions. Admins can do everything.
CREATE POLICY "Everyone can read active questions" ON public.date_feedback_questions
    FOR SELECT USING (true);

CREATE POLICY "Admins can insert questions" ON public.date_feedback_questions
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM public.user_roles WHERE role = 'admin'));

CREATE POLICY "Admins can update questions" ON public.date_feedback_questions
    FOR UPDATE USING (auth.uid() IN (SELECT id FROM public.user_roles WHERE role = 'admin'));

-- Answers: Users can insert their own answers. Users can read their own answers. Admins can read all.
CREATE POLICY "Users can insert own answers" ON public.date_feedback_answers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own answers" ON public.date_feedback_answers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all answers" ON public.date_feedback_answers
    FOR SELECT USING (auth.uid() IN (SELECT id FROM public.user_roles WHERE role = 'admin'));
