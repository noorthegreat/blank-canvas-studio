-- Create the table for event enrollments
create table if not exists public.event_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) not null,
  event_name text not null,
  created_at timestamp with time zone default now() not null,
  unique(user_id, event_name)
);

-- Enable RLS
alter table public.event_enrollments enable row level security;

-- Policies
create policy "Users can view all event enrollments"
  on public.event_enrollments for select
  using (true);

create policy "Users can enroll themselves"
  on public.event_enrollments for insert
  with check (auth.uid() = user_id);

create policy "Users can unenroll themselves"
  on public.event_enrollments for delete
  using (auth.uid() = user_id);
