import type { HsbColor } from "./colorMath";

export const difficulties = ["easy", "hard", "brutal"] as const;
export type Difficulty = (typeof difficulties)[number];

export const difficultyLabels: Record<Difficulty, string> = {
  easy: "Easy",
  hard: "Hard",
  brutal: "Brutal",
};

export type PromptItem = {
  id: string;
  name: string;
  imageSrc: string;
  targetHsb: HsbColor;
  category?: string;
  difficulty?: Difficulty;
};
