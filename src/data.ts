import {
  difficultyLabels,
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

type ChallengeRow = {
  code: string;
  creator_name: string;
  creator_score: number | string | null;
  difficulty: Difficulty;
  prompts: unknown;
  created_at: string;
};

type ChallengeScoreRow = {
  id: string;
  player_name: string;
  total_score: number | string;
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

export type ChallengeEntry = {
  code: string;
  creatorName: string;
  creatorScore: number | null;
  difficulty: Difficulty;
  prompts: PromptItem[];
  createdAt: string;
};

export type ChallengeSubmission = {
  creatorName: string;
  creatorScore?: number;
  difficulty: Difficulty;
  prompts: PromptItem[];
  rounds?: ScoreRound[];
};

export type ChallengeScoreSubmission = {
  challengeCode: string;
  playerName: string;
  totalScore: number;
  rounds: ScoreRound[];
};

export type ChallengeScoreEntry = {
  id: string;
  playerName: string;
  totalScore: number;
  createdAt: string;
};

const LOCAL_SCORES_KEY = "color_game_local_scores";
const GENERATED_PROMPTS_SRC = `${import.meta.env.BASE_URL}assets/prompts/generated/prompts.json`;

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
        "slug,difficulty,category,name,image_src,target_h,target_s,target_b,sort_order",
      )
      .eq("active", true)
      .eq("difficulty", difficulty)
      .order("sort_order", { ascending: true });

    if (!error && data?.length) {
      remotePrompts = (data as PromptRow[]).map((row) => ({
        id: row.slug,
        name: row.name,
        imageSrc: withBaseAsset(row.image_src),
        category: row.category || undefined,
        targetHsb: [row.target_h, row.target_s, row.target_b],
        difficulty: row.difficulty,
      }));
    }
  }

  const generatedPrompts = await loadGeneratedPrompts(difficulty);
  if (remotePrompts.length) return [...remotePrompts, ...generatedPrompts];

  return generatedPrompts;
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

export async function createChallenge(
  submission: ChallengeSubmission,
): Promise<ChallengeEntry | null> {
  if (!supabase) return null;

  const creatorName = cleanPlayerName(submission.creatorName);
  const prompts = submission.prompts.slice(0, 5).map(serializePrompt);
  const rows = submission.rounds?.slice(0, 5).map(serializeRound) || [];
  const creatorScore =
    typeof submission.creatorScore === "number"
      ? Number(submission.creatorScore.toFixed(2))
      : null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomChallengeCode();
    const payload = {
      code,
      creator_name: creatorName,
      creator_score: creatorScore,
      difficulty: submission.difficulty,
      prompts,
    };

    const { data, error } = await supabase
      .from("color_challenges")
      .insert(payload)
      .select("code,creator_name,creator_score,difficulty,prompts,created_at")
      .single();

    if (error) {
      if (error.code === "23505") continue;
      return null;
    }

    if (creatorScore !== null && rows.length) {
      await saveChallengeScore({
        challengeCode: code,
        playerName: creatorName,
        totalScore: creatorScore,
        rounds: rows,
      });
    }

    return challengeRowToEntry(data as ChallengeRow);
  }

  return null;
}

export async function loadChallenge(
  code: string,
): Promise<ChallengeEntry | null> {
  if (!supabase) return null;
  const normalizedCode = normalizeChallengeCode(code);
  if (!normalizedCode) return null;

  const { data, error } = await supabase
    .from("color_challenges")
    .select("code,creator_name,creator_score,difficulty,prompts,created_at")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (error || !data) return null;
  return challengeRowToEntry(data as ChallengeRow);
}

export async function saveChallengeScore(
  submission: ChallengeScoreSubmission,
): Promise<boolean> {
  if (!supabase) return false;
  const challengeCode = normalizeChallengeCode(submission.challengeCode);
  if (!challengeCode) return false;

  const { error } = await supabase.from("color_challenge_scores").insert({
    challenge_code: challengeCode,
    player_name: cleanPlayerName(submission.playerName),
    total_score: Number(submission.totalScore.toFixed(2)),
    rounds: submission.rounds.slice(0, 5).map(serializeRound),
  });

  return !error;
}

export async function loadChallengeScores(
  code: string,
): Promise<ChallengeScoreEntry[]> {
  if (!supabase) return [];
  const challengeCode = normalizeChallengeCode(code);
  if (!challengeCode) return [];

  const { data, error } = await supabase
    .from("color_challenge_scores")
    .select("id,player_name,total_score,created_at")
    .eq("challenge_code", challengeCode)
    .order("total_score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(30);

  if (error || !data) return [];

  const bestByName = new Map<string, ChallengeScoreEntry>();
  (data as ChallengeScoreRow[]).forEach((row) => {
    const entry = challengeScoreRowToEntry(row);
    if (!bestByName.has(entry.playerName)) bestByName.set(entry.playerName, entry);
  });

  return Array.from(bestByName.values()).slice(0, 10);
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

function challengeRowToEntry(row: ChallengeRow): ChallengeEntry | null {
  if (!Array.isArray(row.prompts)) return null;
  const prompts = row.prompts.filter(isChallengePrompt).map((prompt) => ({
    id: prompt.id,
    name: prompt.name,
    imageSrc: withBaseAsset(prompt.imageSrc),
    category: prompt.category,
    targetHsb: prompt.targetHsb,
    difficulty: prompt.difficulty,
  }));
  if (!prompts.length) return null;

  return {
    code: row.code,
    creatorName: row.creator_name,
    creatorScore: row.creator_score === null ? null : Number(row.creator_score),
    difficulty: row.difficulty,
    prompts,
    createdAt: row.created_at,
  };
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

function challengeScoreRowToEntry(row: ChallengeScoreRow): ChallengeScoreEntry {
  return {
    id: row.id,
    playerName: row.player_name,
    totalScore: Number(row.total_score),
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
        imageSrc: withGeneratedVersion(
          withBaseAsset(prompt.imageSrc),
          prompt.createdAt,
        ),
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

function isChallengePrompt(value: unknown): value is PromptItem {
  if (!value || typeof value !== "object") return false;
  const prompt = value as Partial<PromptItem>;
  return (
    typeof prompt.id === "string" &&
    typeof prompt.name === "string" &&
    typeof prompt.imageSrc === "string" &&
    (typeof prompt.category === "string" || prompt.category === undefined) &&
    Array.isArray(prompt.targetHsb) &&
    prompt.targetHsb.length === 3 &&
    prompt.targetHsb.every((channel) => typeof channel === "number") &&
    (prompt.difficulty === "easy" ||
      prompt.difficulty === "hard" ||
      prompt.difficulty === "brutal")
  );
}

function serializePrompt(prompt: PromptItem): PromptItem {
  return {
    id: prompt.id,
    name: prompt.name,
    imageSrc: stripGeneratedVersion(prompt.imageSrc),
    category: prompt.category,
    targetHsb: [...prompt.targetHsb],
    difficulty: prompt.difficulty,
  };
}

function serializeRound(round: ScoreRound): ScoreRound {
  return {
    promptId: round.promptId,
    promptName: round.promptName,
    picked: [...round.picked],
    target: [...round.target],
    score: Number(round.score.toFixed(2)),
  };
}

function stripGeneratedVersion(imageSrc: string): string {
  try {
    const url = new URL(imageSrc, window.location.origin);
    url.searchParams.delete("v");
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.toString();
  } catch {
    return imageSrc;
  }
}

function randomChallengeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint8Array(7));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function normalizeChallengeCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
}

function withGeneratedVersion(imageSrc: string, createdAt?: string): string {
  if (!createdAt) return imageSrc;
  const separator = imageSrc.includes("?") ? "&" : "?";
  return `${imageSrc}${separator}v=${encodeURIComponent(createdAt)}`;
}

function withBaseAsset(imageSrc: string): string {
  if (!imageSrc.startsWith("/assets/")) return imageSrc;
  return `${import.meta.env.BASE_URL}${imageSrc.slice(1)}`;
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
