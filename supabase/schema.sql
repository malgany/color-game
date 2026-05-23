create extension if not exists pgcrypto;

do $$
begin
  create type public.color_difficulty as enum ('easy', 'hard', 'brutal');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.color_prompts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  difficulty public.color_difficulty not null default 'easy',
  category text not null default 'general',
  name text not null,
  image_src text not null,
  target_h smallint not null check (target_h between 0 and 359),
  target_s smallint not null check (target_s between 0 and 100),
  target_b smallint not null check (target_b between 0 and 100),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, difficulty)
);

create table if not exists public.color_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null check (char_length(trim(player_name)) between 1 and 24),
  total_score numeric(5,2) not null check (total_score between 0 and 50),
  difficulty public.color_difficulty not null default 'easy',
  category text not null default 'All categories' check (char_length(trim(category)) between 1 and 40),
  rounds jsonb not null check (jsonb_typeof(rounds) = 'array'),
  created_at timestamptz not null default now()
);

create table if not exists public.color_challenges (
  code text primary key check (code ~ '^[A-Z0-9]{6,10}$'),
  creator_name text not null check (char_length(trim(creator_name)) between 1 and 24),
  creator_score numeric(5,2) check (creator_score is null or creator_score between 0 and 50),
  difficulty public.color_difficulty not null default 'easy',
  prompts jsonb not null check (
    jsonb_typeof(prompts) = 'array'
    and jsonb_array_length(prompts) between 1 and 5
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.color_challenge_scores (
  id uuid primary key default gen_random_uuid(),
  challenge_code text not null references public.color_challenges(code) on delete cascade,
  player_name text not null check (char_length(trim(player_name)) between 1 and 24),
  total_score numeric(5,2) not null check (total_score between 0 and 50),
  rounds jsonb not null check (
    jsonb_typeof(rounds) = 'array'
    and jsonb_array_length(rounds) between 1 and 5
  ),
  created_at timestamptz not null default now()
);

alter table public.color_challenge_scores
  add column if not exists edit_token text;

create index if not exists color_prompts_difficulty_active_sort_idx
  on public.color_prompts (difficulty, active, sort_order);

alter table public.color_prompts
  add column if not exists category text not null default 'general';

alter table public.color_scores
  add column if not exists category text not null default 'All categories';

alter table public.color_scores
  drop constraint if exists color_scores_category_check;

alter table public.color_scores
  add constraint color_scores_category_check
  check (char_length(trim(category)) between 1 and 40);

create index if not exists color_prompts_category_idx
  on public.color_prompts (category);

create index if not exists color_scores_difficulty_score_idx
  on public.color_scores (difficulty, total_score desc, created_at asc);

create index if not exists color_scores_category_score_idx
  on public.color_scores (category, total_score desc, created_at asc);

create index if not exists color_challenges_created_idx
  on public.color_challenges (created_at desc);

alter table public.color_challenges
  alter column creator_score drop not null;

alter table public.color_challenges
  drop constraint if exists color_challenges_creator_score_check;

alter table public.color_challenges
  add constraint color_challenges_creator_score_check
  check (creator_score is null or creator_score between 0 and 50);

create index if not exists color_challenge_scores_code_score_idx
  on public.color_challenge_scores (challenge_code, total_score desc, created_at asc);

alter table public.color_prompts enable row level security;
alter table public.color_scores enable row level security;
alter table public.color_challenges enable row level security;
alter table public.color_challenge_scores enable row level security;

drop policy if exists "Active color prompts are public" on public.color_prompts;
create policy "Active color prompts are public"
  on public.color_prompts for select
  using (active = true);

drop policy if exists "Color scores are public" on public.color_scores;
create policy "Color scores are public"
  on public.color_scores for select
  using (true);

drop policy if exists "Players can submit color scores" on public.color_scores;
create policy "Players can submit color scores"
  on public.color_scores for insert
  with check (
    char_length(trim(player_name)) between 1 and 24
    and total_score between 0 and 50
    and char_length(trim(category)) between 1 and 40
    and jsonb_typeof(rounds) = 'array'
    and jsonb_array_length(rounds) between 1 and 5
  );

drop policy if exists "Color challenges are public" on public.color_challenges;
create policy "Color challenges are public"
  on public.color_challenges for select
  using (true);

drop policy if exists "Players can create color challenges" on public.color_challenges;
create policy "Players can create color challenges"
  on public.color_challenges for insert
  with check (
    code ~ '^[A-Z0-9]{6,10}$'
    and char_length(trim(creator_name)) between 1 and 24
    and (creator_score is null or creator_score between 0 and 50)
    and jsonb_typeof(prompts) = 'array'
    and jsonb_array_length(prompts) between 1 and 5
  );

drop policy if exists "Color challenge scores are public" on public.color_challenge_scores;
create policy "Color challenge scores are public"
  on public.color_challenge_scores for select
  using (true);

drop policy if exists "Players can submit color challenge scores" on public.color_challenge_scores;
create policy "Players can submit color challenge scores"
  on public.color_challenge_scores for insert
  with check (
    char_length(trim(player_name)) between 1 and 24
    and total_score between 0 and 50
    and jsonb_typeof(rounds) = 'array'
    and jsonb_array_length(rounds) between 1 and 5
  );

create or replace function public.update_challenge_score_name(
  score_id uuid,
  score_edit_token text,
  new_player_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.color_challenge_scores
  set player_name = trim(new_player_name)
  where id = score_id
    and edit_token = score_edit_token
    and char_length(trim(new_player_name)) between 1 and 24;

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.update_challenge_score_name(uuid, text, text) from public;
grant execute on function public.update_challenge_score_name(uuid, text, text) to anon, authenticated;

delete from public.color_prompts
where category = 'general'
  and slug in (
    'lemon-star',
    'cherry-cap',
    'cyan-door',
    'lime-leaf',
    'ocean-drop',
    'violet-bolt'
  );

grant usage on schema public to anon, authenticated;
grant select on public.color_prompts to anon, authenticated;
grant select, insert on public.color_scores to anon, authenticated;
grant select, insert on public.color_challenges to anon, authenticated;
grant select, insert on public.color_challenge_scores to anon, authenticated;
