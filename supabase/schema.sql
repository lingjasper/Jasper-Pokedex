-- Jasper Pokedex / B2W2 Living Dex
-- Stage 2 database schema
-- Run this in Supabase SQL Editor.

create table if not exists public.pokemon_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  pokemon_id text not null,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, pokemon_id)
);

alter table public.pokemon_progress enable row level security;

create policy "Users can read their own progress"
on public.pokemon_progress
for select
using (auth.uid() = user_id);

create policy "Users can insert their own progress"
on public.pokemon_progress
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own progress"
on public.pokemon_progress
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own progress"
on public.pokemon_progress
for delete
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pokemon_progress_set_updated_at on public.pokemon_progress;
create trigger pokemon_progress_set_updated_at
before update on public.pokemon_progress
for each row execute function public.set_updated_at();
