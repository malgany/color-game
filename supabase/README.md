# Supabase Setup

Project created in Supabase:

- Name: Color Game
- Ref: `leleedkossyoourxqyml`
- URL: `https://leleedkossyoourxqyml.supabase.co`

The local app reads Supabase config from:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`schema.sql` creates:

- `public.color_prompts`: image prompt catalog, target HSB color, difficulty, and active flag.
- `public.color_scores`: public leaderboard scores with player name, total score, difficulty, and round detail JSON.
- RLS policies for public prompt reads, public leaderboard reads, and client score inserts.

The frontend falls back to the local placeholder catalog and localStorage scores when Supabase config is missing or unavailable.
