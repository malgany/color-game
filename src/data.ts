import {
  difficultyLabels,
  promptCatalog,
  type Difficulty,
  type PromptItem,
} from "./catalog";
import type { HsbColor } from "./colorMath";
import { supabase } from "./supabaseClient";

type PromptRow = {
  slug: string;
  difficulty: Difficulty;
  name: string;
  image_src: string;
  category?: string | null;
  target_h: number;
  target_s: number;
  target_b: number;
};

type ScoreRow = {
  id: string;
  player_name: string;
  total_score: number | string;
  difficulty: Difficulty;
  created_at: string;
};

export type ScoreRound = {
  promptId: string;
  promptName: string;
  picked: HsbColor;
  target: HsbColor;
  score: number;
};

export type ScoreSubmission = {
  playerName: string;
  totalScore: number;
  difficulty: Difficulty;
  rounds: ScoreRound[];
};

export type LeaderboardEntry = {
  id: string;
  playerName: string;
  totalScore: number;
  difficulty: Difficulty;
  createdAt: string;
};

const LOCAL_SCORES_KEY = "color_game_local_scores";
const GENERATED_PROMPTS_SRC = "/assets/prompts/generated/prompts.json";

export { difficultyLabels };
export type { Difficulty, PromptItem };

export async function loadPrompts(
  difficulty: Difficulty,
): Promise<PromptItem[]> {
  let remotePrompts: PromptItem[] = [];

  if (supabase) {
    const { data, error } = await supabase
      .from("color_prompts")
      .select(
        "slug,difficulty,name,image_src,target_h,target_s,target_b,sort_order",
      )
      .eq("active", true)
      .eq("difficulty", difficulty)
      .order("sort_order", { ascending: true });

    if (!error && data?.length) {
      remotePrompts = (data as PromptRow[]).map((row) => ({
        id: row.slug,
        name: row.name,
        imageSrc: row.image_src,
        category: row.category || undefined,
        targetHsb: [row.target_h, row.target_s, row.target_b],
        difficulty: row.difficulty,
      }));
    }
  }

  const generatedPrompts = await loadGeneratedPrompts(difficulty);
  if (remotePrompts.length) return [...remotePrompts, ...generatedPrompts];

  return [
    ...promptCatalog.map((prompt) => ({ ...prompt, difficulty })),
    ...generatedPrompts,
  ];
}

export async function loadCategories(): Promise<string[]> {
  const generatedPrompts = await loadGeneratedPrompts();
  return Array.from(
    new Set(
      generatedPrompts
        .map((prompt) => prompt.category)
        .filter((category): category is string => Boolean(category))
        .sort((a, b) => a.localeCompare(b)),
    ),
  );
}

export async function saveScore(
  submission: ScoreSubmission,
): Promise<"remote" | "local"> {
  const playerName = cleanPlayerName(submission.playerName);
  const payload = {
    player_name: playerName,
    total_score: Number(submission.totalScore.toFixed(2)),
    difficulty: submission.difficulty,
    rounds: submission.rounds,
  };

  if (supabase) {
    const { error } = await supabase.from("color_scores").insert(payload);
    if (!error) return "remote";
  }

  const scores = readLocalScores();
  scores.push({
    id: crypto.randomUUID(),
    playerName,
    totalScore: payload.total_score,
    difficulty: submission.difficulty,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores.slice(-100)));
  return "local";
}

export async function loadLeaderboard(
  difficulty: Difficulty,
): Promise<LeaderboardEntry[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("color_scores")
      .select("id,player_name,total_score,difficulty,created_at")
      .eq("difficulty", difficulty)
      .order("total_score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(20);

    if (!error && data) return (data as ScoreRow[]).map(scoreRowToEntry);
  }

  return readLocalScores()
    .filter((entry) => entry.difficulty === difficulty)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20);
}

function scoreRowToEntry(row: ScoreRow): LeaderboardEntry {
  return {
    id: row.id,
    playerName: row.player_name,
    totalScore: Number(row.total_score),
    difficulty: row.difficulty,
    createdAt: row.created_at,
  };
}

async function loadGeneratedPrompts(
  difficulty?: Difficulty,
): Promise<PromptItem[]> {
  try {
    const response = await fetch(`${GENERATED_PROMPTS_SRC}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return [];

    const value = await response.json();
    if (!Array.isArray(value)) return [];

    return value
      .filter(isGeneratedPrompt)
      .filter((prompt) => !difficulty || prompt.difficulty === difficulty)
      .map((prompt) => ({
        id: prompt.slug,
        name: prompt.name,
        imageSrc: withGeneratedVersion(prompt.imageSrc, prompt.createdAt),
        category: prompt.category,
        targetHsb: prompt.targetHsb,
        difficulty: prompt.difficulty,
      }));
  } catch {
    return [];
  }
}

function isGeneratedPrompt(value: unknown): value is {
  slug: string;
  name: string;
  imageSrc: string;
  category?: string;
  targetHsb: HsbColor;
  difficulty: Difficulty;
  createdAt?: string;
} {
  if (!value || typeof value !== "object") return false;
  const prompt = value as Partial<{
    slug: string;
    name: string;
    imageSrc: string;
    category?: string;
    targetHsb: unknown;
    difficulty: string;
    createdAt?: string;
  }>;

  return (
    typeof prompt.slug === "string" &&
    typeof prompt.name === "string" &&
    typeof prompt.imageSrc === "string" &&
    (typeof prompt.category === "string" || prompt.category === undefined) &&
    (typeof prompt.createdAt === "string" || prompt.createdAt === undefined) &&
    Array.isArray(prompt.targetHsb) &&
    prompt.targetHsb.length === 3 &&
    prompt.targetHsb.every((channel) => typeof channel === "number") &&
    (prompt.difficulty === "easy" ||
      prompt.difficulty === "hard" ||
      prompt.difficulty === "brutal")
  );
}

function withGeneratedVersion(imageSrc: string, createdAt?: string): string {
  if (!createdAt) return imageSrc;
  const separator = imageSrc.includes("?") ? "&" : "?";
  return `${imageSrc}${separator}v=${encodeURIComponent(createdAt)}`;
}

function readLocalScores(): LeaderboardEntry[] {
  try {
    const value = localStorage.getItem(LOCAL_SCORES_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLeaderboardEntry);
  } catch {
    return [];
  }
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<LeaderboardEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.playerName === "string" &&
    typeof entry.totalScore === "number" &&
    typeof entry.createdAt === "string" &&
    (entry.difficulty === "easy" ||
      entry.difficulty === "hard" ||
      entry.difficulty === "brutal")
  );
}

export function cleanPlayerName(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, 24);
  return cleaned || "Player";
}
