export type ProblemStatus = "unsolved" | "solved" | "revisit" | "skipped";

export type Difficulty = "Easy" | "Medium" | "Hard";
export type ActivityKind = "solved" | "revision" | "revisit";

export type TopicSeed = {
  name: string;
  slug: string;
  problemSet?: string;
  order: number;
  targetCount: number;
  description: string;
  accent: string;
};

export type Prerequisite = {
  title: string;
  platformName?: string;
  platformUrl?: string;
  note?: string;
  kind?: "prerequisite" | "warmup" | "stepping_stone";
};

export type ProblemSeed = {
  title: string;
  topicSlug: string;
  problemSet?: string;
  roadmapSection?: string;
  roadmapSectionOrder?: number;
  roadmapOrder?: number;
  platformName: string;
  platformUrl: string;
  difficulty: Difficulty;
  status: ProblemStatus;
  pattern?: string;
  invariant?: string;
  rating?: number;
  shortNote: string;
  longNote: string;
  mistakeLog?: string;
  mistakeTrigger?: string;
  mistakeReason?: string;
  mistakeFix?: string;
  compareBruteForce?: string;
  compareOptimized?: string;
  compareWhyBetter?: string;
  prerequisites?: Prerequisite[];
  tags: string[];
  priority: number;
  isPinned: boolean;
  revisionCount?: number;
  revisionStage?: number;
  lastRevisionAt?: Date;
  nextRevisionAt?: Date;
  revisionCompletedAt?: Date;
};

