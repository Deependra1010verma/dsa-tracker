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

export type ProblemSeed = {
  title: string;
  topicSlug: string;
  roadmapSection?: string;
  roadmapSectionOrder?: number;
  roadmapOrder?: number;
  platformName: string;
  platformUrl: string;
  difficulty: Difficulty;
  status: ProblemStatus;
  pattern?: string;
  rating?: number;
  shortNote: string;
  longNote: string;
  tags: string[];
  priority: number;
  isPinned: boolean;
  revisionCount?: number;
  revisionStage?: number;
  lastRevisionAt?: Date;
  nextRevisionAt?: Date;
  revisionCompletedAt?: Date;
};
