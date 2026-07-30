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

export type PatternFamilyItem = {
  title: string;
  platformName?: string;
  platformUrl?: string;
  note?: string;
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
  patternFamily?: PatternFamilyItem[];
  tags: string[];
  priority: number;
  isPinned: boolean;
  revisionCount?: number;
  revisionStage?: number;
  lastRevisionAt?: Date;
  nextRevisionAt?: Date;
  revisionCompletedAt?: Date;
  fromCustomSeed?: boolean;
};

export type GeneralNoteCategory =
  | "Data Structures"
  | "Algorithmic Patterns"
  | "Mistakes & Anti-Patterns"
  | "Interview Strategy"
  | "Language & Syntax"
  | "System Design";

export type GeneralNoteImportance = "Essential" | "Important" | "Good to Know";

export type CodeSnippetItem = {
  title?: string;
  language?: string;
  code: string;
  explanation?: string;
};

export type MistakeItem = {
  mistake: string;
  whyBad?: string;
  correctFix?: string;
};

export type GeneralNote = {
  _id: string;
  title: string;
  category: GeneralNoteCategory;
  summary: string;
  content: string;
  keyTakeaways?: string[];
  mistakesToAvoid?: MistakeItem[];
  codeSnippets?: CodeSnippetItem[];
  tags: string[];
  importance: GeneralNoteImportance;
  isPinned: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

