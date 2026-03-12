-- Allow admins to read all friendship answers for admin analytics.
CREATE POLICY "Admins can select all friendship answers"
ON public.friendship_answers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);
