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
  rounds jsonb not null check (jsonb_typeof(rounds) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists color_prompts_difficulty_active_sort_idx
  on public.color_prompts (difficulty, active, sort_order);

create index if not exists color_scores_difficulty_score_idx
  on public.color_scores (difficulty, total_score desc, created_at asc);

alter table public.color_prompts enable row level security;
alter table public.color_scores enable row level security;

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
    and jsonb_typeof(rounds) = 'array'
    and jsonb_array_length(rounds) between 1 and 5
  );

grant usage on schema public to anon, authenticated;
grant select on public.color_prompts to anon, authenticated;
grant select, insert on public.color_scores to anon, authenticated;

insert into public.color_prompts (
  slug,
  difficulty,
  name,
  image_src,
  target_h,
  target_s,
  target_b,
  sort_order
)
select
  seed.slug,
  seed.difficulty::public.color_difficulty,
  seed.name,
  seed.image_src,
  seed.target_h,
  seed.target_s,
  seed.target_b,
  seed.sort_order
from (
  values
    ('lemon-star', 'easy', 'Lemon star', '/assets/prompts/lemon-star.png', 52, 90, 95, 10),
    ('cherry-cap', 'easy', 'Cherry cap', '/assets/prompts/cherry-cap.png', 356, 78, 88, 20),
    ('ocean-drop', 'easy', 'Ocean drop', '/assets/prompts/ocean-drop.png', 202, 86, 75, 30),
    ('lime-leaf', 'easy', 'Lime leaf', '/assets/prompts/lime-leaf.png', 112, 75, 78, 40),
    ('violet-bolt', 'easy', 'Violet bolt', '/assets/prompts/violet-bolt.png', 278, 70, 82, 50),
    ('lemon-star', 'hard', 'Lemon star', '/assets/prompts/lemon-star.png', 52, 90, 95, 10),
    ('cherry-cap', 'hard', 'Cherry cap', '/assets/prompts/cherry-cap.png', 356, 78, 88, 20),
    ('ocean-drop', 'hard', 'Ocean drop', '/assets/prompts/ocean-drop.png', 202, 86, 75, 30),
    ('lime-leaf', 'hard', 'Lime leaf', '/assets/prompts/lime-leaf.png', 112, 75, 78, 40),
    ('violet-bolt', 'hard', 'Violet bolt', '/assets/prompts/violet-bolt.png', 278, 70, 82, 50),
    ('lemon-star', 'brutal', 'Lemon star', '/assets/prompts/lemon-star.png', 52, 90, 95, 10),
    ('cherry-cap', 'brutal', 'Cherry cap', '/assets/prompts/cherry-cap.png', 356, 78, 88, 20),
    ('ocean-drop', 'brutal', 'Ocean drop', '/assets/prompts/ocean-drop.png', 202, 86, 75, 30),
    ('lime-leaf', 'brutal', 'Lime leaf', '/assets/prompts/lime-leaf.png', 112, 75, 78, 40),
    ('violet-bolt', 'brutal', 'Violet bolt', '/assets/prompts/violet-bolt.png', 278, 70, 82, 50)
) as seed(slug, difficulty, name, image_src, target_h, target_s, target_b, sort_order)
on conflict (slug, difficulty) do update set
  name = excluded.name,
  image_src = excluded.image_src,
  target_h = excluded.target_h,
  target_s = excluded.target_s,
  target_b = excluded.target_b,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();
