-- Add new column to profiles
ALTER TABLE public.profiles ADD COLUMN completed_friendship_questionnaire boolean DEFAULT false;

-- Create friendship_questions table
CREATE TABLE public.friendship_questions (
    id SERIAL PRIMARY KEY,
    question text NOT NULL,
    options jsonb,
    min_responses integer,
    max_responses integer,
    multi_select boolean,
    show_if jsonb,
    range_slider boolean,
    min_value integer,
    max_value integer,
    default_range integer[],
    allow_custom boolean,
    has_dropdown boolean,
    ranked boolean,
    default_answer text,
    disabled boolean,
    order_index integer
);

-- Create friendship_answers table
CREATE TABLE public.friendship_answers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users NOT NULL,
    question_number integer NOT NULL,
    question_id integer REFERENCES public.friendship_questions(id),
    answer text NOT NULL,
    answer_custom text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, question_number)
);

-- Enable RLS
ALTER TABLE public.friendship_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendship_answers ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Enable read access for all users" ON public.friendship_questions FOR SELECT USING (true);
CREATE POLICY "Users can insert their own answers" ON public.friendship_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can select their own answers" ON public.friendship_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own answers" ON public.friendship_answers FOR UPDATE USING (auth.uid() = user_id);
