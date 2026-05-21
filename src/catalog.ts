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
  difficulty?: Difficulty;
};

export const promptCatalog: PromptItem[] = [
  {
    id: "lemon-star",
    name: "Lemon star",
    imageSrc: "/assets/prompts/lemon-star.png",
    targetHsb: [52, 90, 95],
  },
  {
    id: "cherry-cap",
    name: "Cherry cap",
    imageSrc: "/assets/prompts/cherry-cap.png",
    targetHsb: [356, 78, 88],
  },
  {
    id: "ocean-drop",
    name: "Ocean drop",
    imageSrc: "/assets/prompts/ocean-drop.png",
    targetHsb: [202, 86, 75],
  },
  {
    id: "lime-leaf",
    name: "Lime leaf",
    imageSrc: "/assets/prompts/lime-leaf.png",
    targetHsb: [112, 75, 78],
  },
  {
    id: "violet-bolt",
    name: "Violet bolt",
    imageSrc: "/assets/prompts/violet-bolt.png",
    targetHsb: [278, 70, 82],
  },
];
