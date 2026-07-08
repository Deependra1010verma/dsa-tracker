export type ProblemStatus = "unsolved" | "solved" | "revisit" | "skipped";

export type Difficulty = "Easy" | "Medium" | "Hard";

export type TopicSeed = {
  name: string;
  slug: string;
  order: number;
  targetCount: number;
  description: string;
  accent: string;
};

