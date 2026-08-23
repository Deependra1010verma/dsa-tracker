import type { PatternFamilyItem, Prerequisite } from "./api/types";

export type Difficulty = "Easy" | "Medium" | "Hard";
export type Status = "unsolved" | "solved" | "revisit" | "skipped";
export type SortByOption = "optimal" | "status" | "difficulty" | "rating" | "title";

export type Topic = {
  _id: string;
  name: string;
  slug: string;
  order: number;
  targetCount: number;
  description: string;
  accent: string;
  totalProblems?: number;
  solvedCount?: number;
  revisitCount?: number;
};

export type Problem = {
  _id: string;
  title: string;
  platformName: string;
  platformUrl: string;
  roadmapSection?: string;
  roadmapSectionOrder?: number;
  roadmapOrder?: number;
  difficulty: Difficulty;
  status: Status;
  pattern?: string;
  invariant?: string;
  compareBruteForce?: string;
  compareOptimized?: string;
  compareWhyBetter?: string;
  prerequisites?: Prerequisite[];
  patternFamily?: PatternFamilyItem[];
  rating?: number;
  shortNote: string;
  longNote?: string;
  codeSnippet?: string;
  codeSnippetLang?: string;
  mistakeLog?: string;
  mistakeTrigger?: string;
  mistakeReason?: string;
  mistakeFix?: string;
  revisionCount: number;
  revisionStage?: number;
  solvedAt?: string | null;
  revisitAt?: string | null;
  lastRevisionAt?: string | null;
  nextRevisionAt?: string | null;
  revisionCompletedAt?: string | null;
  tags: string[];
  priority: number;
  isPinned: boolean;
  topic: Topic;
  updatedAt: string;
};

export type Stats = {
  totalProblems: number;
  solvedProblems: number;
  revisitProblems: number;
  unsolvedProblems: number;
  skippedProblems: number;
};

export type ProblemFormState = {
  title: string;
  topicId: string;
  roadmapSection: string;
  platformName: string;
  platformUrl: string;
  difficulty: Difficulty;
  status: Status;
  pattern: string;
  invariant: string;
  compareBruteForce: string;
  compareOptimized: string;
  compareWhyBetter: string;
  prerequisites: Prerequisite[];
  rating: number;
  shortNote: string;
  longNote: string;
  codeSnippet: string;
  codeSnippetLang: string;
  mistakeLog: string;
  mistakeTrigger: string;
  mistakeReason: string;
  mistakeFix: string;
  tags: string;
  priority: number;
  isPinned: boolean;
};

export type RevisionState = {
  stage: number;
  label: string;
  subtitle: string;
  dueDate: Date | null;
  isDue: boolean;
  isOverdue: boolean;
  isComplete: boolean;
  isScheduled: boolean;
  daysAway: number | null;
};

export type RevisionQueueMeta = {
  score: number;
  label: string;
};

export type ActivityKind = "solved" | "revision" | "revisit";

export type ActivityRecord = {
  _id: string;
  kind: ActivityKind;
  occurredAt: string;
  problem: {
    _id: string;
    title: string;
    difficulty: Difficulty;
    platformName: string;
  };
  topic: {
    _id: string;
    name: string;
  };
};

export type ActivityProblemSnapshot = {
  _id: string;
  title: string;
  difficulty: Difficulty;
  platformName: string;
};

export type ActivityTopicSnapshot = {
  _id: string;
  name: string;
};

export type ActivityEntry = {
  problemId: string;
  problemTitle: string;
  topicId: string;
  topicName: string;
  difficulty: Difficulty;
  platformName: string;
  kind: ActivityKind;
};

export type ActivityDayBucket = {
  date: Date;
  dateKey: string;
  solved: number;
  revision: number;
  revisit: number;
  total: number;
  items: ActivityEntry[];
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
};

export type ActivityWeek = {
  label: string;
  days: ActivityDayBucket[];
};

export type ActivityInsights = {
  currentStreak: number;
  bestStreak: number;
  activeDays: number;
  totalActivity: number;
  solvedActivity: number;
  revisionActivity: number;
  revisitActivity: number;
  todayCount: number;
  thisWeekCount: number;
  lastActiveLabel: string;
  weeks: ActivityWeek[];
};

export type RecallPrompt = {
  question: string;
  hint: string;
};

export type RatingFilterOption = "all" | "10" | "8-9" | "5-7";

export type PersistedViewState = {
  search?: string;
  statusFilter?: Status | "all" | "revisit";
  difficultyFilter?: Difficulty | "all";
  ratingFilter?: RatingFilterOption;
  selectedTopic?: string;
  selectedProblemSet?: string;
  activeProblemId?: string | null;
  drawerOpen?: boolean;
  drawerMode?: "edit" | "notes";
};

export type WorkspaceSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export type SavedProblemProgress = {
  status?: Status;
  isPinned?: boolean;
  solvedAt?: string | null;
  revisitAt?: string | null;
  lastRevisionAt?: string | null;
  nextRevisionAt?: string | null;
  revisionCompletedAt?: string | null;
  revisionCount?: number;
  revisionStage?: number;
  updatedAt: number;
};

export type LocalProgressMap = Record<string, SavedProblemProgress>;

