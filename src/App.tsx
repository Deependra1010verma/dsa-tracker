import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, Fragment, type FormEvent } from "react";
import { topicSubCategories } from "./data/categories";

type Difficulty = "Easy" | "Medium" | "Hard";
type Status = "unsolved" | "solved" | "revisit" | "skipped";

type Topic = {
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

type Problem = {
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
  rating?: number;
  shortNote: string;
  longNote?: string;
  mistakeLog?: string;
  mistakeTrigger?: string;
  mistakeReason?: string;
  mistakeFix?: string;
  revisionCount: number;
  revisionStage?: number;
  solvedAt?: string;
  revisitAt?: string;
  lastRevisionAt?: string;
  nextRevisionAt?: string;
  revisionCompletedAt?: string;
  tags: string[];
  priority: number;
  isPinned: boolean;
  topic: Topic;
  updatedAt: string;
};

type Stats = {
  totalProblems: number;
  solvedProblems: number;
  revisitProblems: number;
  unsolvedProblems: number;
  skippedProblems: number;
};

type ProblemFormState = {
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
  rating: number;
  shortNote: string;
  longNote: string;
  mistakeLog: string;
  mistakeTrigger: string;
  mistakeReason: string;
  mistakeFix: string;
  tags: string;
  priority: number;
  isPinned: boolean;
};

const emptyForm: ProblemFormState = {
  title: "",
  topicId: "",
  roadmapSection: "",
  platformName: "",
  platformUrl: "",
  difficulty: "Easy",
  status: "unsolved",
  pattern: "",
  invariant: "",
  compareBruteForce: "",
  compareOptimized: "",
  compareWhyBetter: "",
  rating: 0,
  shortNote: "",
  longNote: "",
  mistakeLog: "",
  mistakeTrigger: "",
  mistakeReason: "",
  mistakeFix: "",
  tags: "",
  priority: 0,
  isPinned: false,
};

const statusLabels: Record<Status, string> = {
  unsolved: "Unsolved",
  solved: "Solved",
  revisit: "Revisit",
  skipped: "Skipped",
};

const difficultyTone: Record<Difficulty, string> = {
  Easy: "tone-easy",
  Medium: "tone-medium",
  Hard: "tone-hard",
};

const spacedRevisionDays = [1, 3, 7, 15, 30] as const;

type RevisionState = {
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

type RevisionQueueMeta = {
  score: number;
  label: string;
};

type ProblemRowProps = {
  problem: Problem;
  displayIndex: number;
  canEdit: boolean;
  revisionState: RevisionState;
  categories: string[];
  onOpenStudy: (problem: Problem) => void;
  onToggleStatus: (problem: Problem, nextStatus: Status) => void;
  onOpenEdit: (problem: Problem) => void;
  onTogglePin: (problem: Problem) => void;
  onOpenLink: (problem: Problem) => void;
  onDelete: (problemId: string) => void;
};

type SectionBlockProps = {
  group: {
    sectionKey: string;
    sectionName: string;
    solvedCount: number;
    totalCount: number;
    problems: Array<{ problem: Problem; displayIndex: number }>;
  };
  accent: string;
  canEdit: boolean;
  revisionStateMap: Map<string, RevisionState>;
  problemCategoryMap: Map<string, string[]>;
  nowDate: Date;
  onOpenStudy: (problem: Problem) => void;
  onToggleStatus: (problem: Problem, nextStatus: Status) => void;
  onOpenEdit: (problem: Problem) => void;
  onTogglePin: (problem: Problem) => void;
  onOpenLink: (problem: Problem) => void;
  onDelete: (problemId: string) => void;
  rowLimit: number;
  onLoadMore: () => void;
};

function formatRating(rating?: number) {
  return typeof rating === "number" && rating > 0 ? `${rating}/10` : "";
}

function composeMistakeLog(trigger: string, reason: string, fix: string) {
  return [trigger.trim(), reason.trim(), fix.trim()].filter(Boolean).join("\n\n");
}

function splitMistakeLog(value?: string | null) {
  const parts = (value ?? "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    trigger: parts[0] ?? "",
    reason: parts[1] ?? "",
    fix: parts[2] ?? "",
  };
}

type RecallPrompt = {
  question: string;
  hint: string;
};

type SummaryItem = {
  label: string;
  value: string;
};

type ActivityKind = "solved" | "revision" | "revisit";

type ActivityRecord = {
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

type ActivityEntry = {
  problemId: string;
  problemTitle: string;
  topicId: string;
  topicName: string;
  difficulty: Difficulty;
  platformName: string;
  kind: ActivityKind;
};

type ActivityDayBucket = {
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

type ActivityWeek = {
  label: string;
  days: ActivityDayBucket[];
};

type ActivityInsights = {
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

function buildRecallPrompts(problem: Problem): RecallPrompt[] {
  const tagSummary = problem.tags.length > 0 ? problem.tags.slice(0, 3).join(", ") : "look for the smallest useful state";
  const patternHint = problem.pattern?.trim() || problem.topic?.name || "infer the pattern from the constraints";
  const invariantHint = problem.invariant?.trim() || "state what must stay true after each step";
  const compareHint =
    problem.compareWhyBetter?.trim() ||
    problem.compareOptimized?.trim() ||
    "focus on what the optimized version removes or improves";
  const mistakeHint =
    splitMistakeLog(problem.mistakeLog).fix ||
    problem.mistakeFix ||
    "name the edge case that breaks your first approach";

  return [
    {
      question: "What pattern should you reach for first?",
      hint: patternHint,
    },
    {
      question: "What invariant must remain true?",
      hint: invariantHint,
    },
    {
      question: "Why is the optimized approach better than brute force?",
      hint: compareHint,
    },
    {
      question: "What state or data structure actually changes while solving?",
      hint: tagSummary,
    },
    {
      question: "Which edge case or mistake has hurt you before?",
      hint: mistakeHint,
    },
    {
      question: "How would you explain the optimized idea in one sentence?",
      hint: problem.shortNote || "keep it short and focus on the core transition",
    },
  ];
}

function buildProblemSummary(problem: Problem): SummaryItem[] {
  const { trigger, reason, fix } = splitMistakeLog(problem.mistakeLog);

  return [
    {
      label: "Problem",
      value: `${problem.title}${problem.platformName ? ` · ${problem.platformName}` : ""}`,
    },
    {
      label: "Pattern",
      value: problem.pattern?.trim() || "Not set yet",
    },
    {
      label: "Invariant",
      value: problem.invariant?.trim() || "Not set yet",
    },
    {
      label: "Brute force",
      value: problem.compareBruteForce?.trim() || "Not set yet",
    },
    {
      label: "Optimized idea",
      value: problem.compareOptimized?.trim() || problem.longNote?.trim() || "Not set yet",
    },
    {
      label: "Why better",
      value: problem.compareWhyBetter?.trim() || "Not set yet",
    },
    {
      label: "Mistake",
      value: trigger || "Not set yet",
    },
    {
      label: "Fix",
      value: fix || problem.mistakeFix?.trim() || "Not set yet",
    },
    {
      label: "Takeaway",
      value: reason || problem.shortNote?.trim() || "Not set yet",
    },
  ];
}

function toValidDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function getWeekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function daysBetween(now: Date, target: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / msPerDay);
}

function formatActivityDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatActivityLevel(total: number, solved: number, revision: number, revisit: number): 0 | 1 | 2 | 3 | 4 {
  if (total <= 0) {
    return 0;
  }

  const weightedScore = solved * 2 + revision + revisit;
  if (weightedScore >= 5 || total >= 4) {
    return 4;
  }
  if (weightedScore >= 3 || total >= 3) {
    return 3;
  }
  if (weightedScore >= 2 || total >= 2) {
    return 2;
  }
  return 1;
}

function createEmptyInsights(weeksToShow: number, nowDate: Date): ActivityInsights {
  const today = startOfDay(nowDate);
  const currentWeekStart = addDays(today, -getWeekdayIndex(today));
  const gridStart = addDays(currentWeekStart, -(weeksToShow - 1) * 7);
  const weeks: ActivityWeek[] = [];

  for (let weekIndex = 0; weekIndex < weeksToShow; weekIndex += 1) {
    const weekStart = addDays(gridStart, weekIndex * 7);
    weeks.push({
      label: weekStart.toLocaleString("en-US", { month: "short" }),
      days: Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDays(weekStart, dayIndex);
        const isToday = toDateKey(date) === toDateKey(today);
        return {
          date,
          dateKey: toDateKey(date),
          solved: 0,
          revision: 0,
          revisit: 0,
          total: 0,
          items: [],
          level: 0,
          isToday,
          isFuture: startOfDay(date).getTime() > today.getTime(),
        };
      }),
    });
  }

  return {
    currentStreak: 0,
    bestStreak: 0,
    activeDays: 0,
    totalActivity: 0,
    solvedActivity: 0,
    revisionActivity: 0,
    revisitActivity: 0,
    todayCount: 0,
    thisWeekCount: 0,
    lastActiveLabel: "No activity yet",
    weeks,
  };
}

function buildActivityInsights(activities: ActivityRecord[], nowDate: Date, weeksToShow = 16): ActivityInsights {
  const empty = createEmptyInsights(weeksToShow, nowDate);
  const activityMap = new Map<string, { solved: number; revision: number; revisit: number; total: number; items: ActivityEntry[] }>();
  const today = startOfDay(nowDate);

  const addActivity = (date: Date | null, activity: ActivityRecord) => {
    if (!date) {
      return;
    }

    const dateKey = toDateKey(startOfDay(date));
    const bucket = activityMap.get(dateKey) ?? { solved: 0, revision: 0, revisit: 0, total: 0, items: [] };
    bucket[activity.kind] += 1;
    bucket.total += 1;
    bucket.items.push({
      problemId: activity.problem._id,
      problemTitle: activity.problem.title,
      topicId: activity.topic._id,
      topicName: activity.topic.name,
      difficulty: activity.problem.difficulty,
      platformName: activity.problem.platformName,
      kind: activity.kind,
    });
    activityMap.set(dateKey, bucket);
  };

  for (const activity of activities) {
    addActivity(toValidDate(activity.occurredAt), activity);
  }

  if (activityMap.size === 0) {
    return empty;
  }

  const orderedKeys = [...activityMap.keys()].sort();
  const activeDateSet = new Set(orderedKeys);
  let bestStreak = 0;
  let rollingStreak = 0;
  let previousDate: Date | null = null;

  for (const key of orderedKeys) {
    const currentDate = fromDateKey(key);
    if (previousDate && daysBetween(previousDate, currentDate) === 1) {
      rollingStreak += 1;
    } else {
      rollingStreak = 1;
    }
    bestStreak = Math.max(bestStreak, rollingStreak);
    previousDate = currentDate;
  }

  let currentStreak = 0;
  const todayKey = toDateKey(today);
  const yesterdayKey = toDateKey(addDays(today, -1));
  let streakCursor = activeDateSet.has(todayKey) ? today : activeDateSet.has(yesterdayKey) ? addDays(today, -1) : null;

  while (streakCursor) {
    const cursorKey = toDateKey(streakCursor);
    if (!activeDateSet.has(cursorKey)) {
      break;
    }
    currentStreak += 1;
    streakCursor = addDays(streakCursor, -1);
  }

  const currentWeekStart = addDays(today, -getWeekdayIndex(today));
  const gridStart = addDays(currentWeekStart, -(weeksToShow - 1) * 7);
  const weeks: ActivityWeek[] = [];
  let thisWeekCount = 0;

  for (let weekIndex = 0; weekIndex < weeksToShow; weekIndex += 1) {
    const weekStart = addDays(gridStart, weekIndex * 7);
    const days: ActivityDayBucket[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = addDays(weekStart, dayIndex);
      const dateKey = toDateKey(date);
      const counts = activityMap.get(dateKey) ?? { solved: 0, revision: 0, revisit: 0, total: 0, items: [] };
      const isFuture = startOfDay(date).getTime() > today.getTime();
      const level = isFuture ? 0 : formatActivityLevel(counts.total, counts.solved, counts.revision, counts.revisit);
      const isToday = dateKey === todayKey;

      if (!isFuture && startOfDay(date).getTime() >= currentWeekStart.getTime()) {
        thisWeekCount += counts.total;
      }

      days.push({
        date,
        dateKey,
        solved: counts.solved,
        revision: counts.revision,
        revisit: counts.revisit,
        total: counts.total,
        items: [...counts.items].sort((left, right) => left.problemTitle.localeCompare(right.problemTitle)),
        level,
        isToday,
        isFuture,
      });
    }

    weeks.push({
      label: weekStart.toLocaleString("en-US", { month: "short" }),
      days,
    });
  }

  const latestKey = orderedKeys[orderedKeys.length - 1];
  const latestDate = fromDateKey(latestKey);
  const latestDaysAgo = Math.max(daysBetween(latestDate, today), 0);
  const latestBucket = activityMap.get(latestKey) ?? { solved: 0, revision: 0, revisit: 0, total: 0, items: [] };

  let lastActiveLabel = "Active today";
  if (latestDaysAgo === 1) {
    lastActiveLabel = `Last active yesterday · ${latestBucket.total} item${latestBucket.total === 1 ? "" : "s"}`;
  } else if (latestDaysAgo > 1) {
    lastActiveLabel = `Last active ${formatActivityDate(latestDate)} · ${latestBucket.total} item${latestBucket.total === 1 ? "" : "s"}`;
  }

  const totals = [...activityMap.values()].reduce(
    (acc, bucket) => {
      acc.total += bucket.total;
      acc.solved += bucket.solved;
      acc.revision += bucket.revision;
      acc.revisit += bucket.revisit;
      return acc;
    },
    { total: 0, solved: 0, revision: 0, revisit: 0 }
  );

  return {
    currentStreak,
    bestStreak,
    activeDays: orderedKeys.length,
    totalActivity: totals.total,
    solvedActivity: totals.solved,
    revisionActivity: totals.revision,
    revisitActivity: totals.revisit,
    todayCount: activityMap.get(todayKey)?.total ?? 0,
    thisWeekCount,
    lastActiveLabel,
    weeks,
  };
}

function formatRevisionDueText(daysAway: number | null, isDue: boolean, isComplete: boolean) {
  if (isComplete) {
    return "Completed";
  }

  if (daysAway === null) {
    return "Scheduled";
  }

  if (daysAway < 0) {
    return `Overdue by ${Math.abs(daysAway)} day${Math.abs(daysAway) === 1 ? "" : "s"}`;
  }

  if (daysAway === 0) {
    return isDue ? "Due today" : "Today";
  }

  if (daysAway === 1) {
    return "Tomorrow";
  }

  return `${daysAway} days`;
}

function getRevisionState(problem: Problem, now: Date): RevisionState {
  const solvedAt = toValidDate(problem.solvedAt);
  const revisitAt = toValidDate(problem.revisitAt);
  const lastRevisionAt = toValidDate(problem.lastRevisionAt);
  const nextRevisionAt = toValidDate(problem.nextRevisionAt);
  const completedAt = toValidDate(problem.revisionCompletedAt);
  const anchor = lastRevisionAt ?? revisitAt ?? solvedAt ?? toValidDate(problem.updatedAt) ?? now;
  const stage = Math.max(problem.revisionStage ?? (problem.revisionCount > 0 ? Math.min(problem.revisionCount - 1, spacedRevisionDays.length) : 0), 0);
  const isComplete = Boolean(completedAt || (stage >= spacedRevisionDays.length && !nextRevisionAt));
  const isScheduled = problem.status === "solved" || problem.status === "revisit";

  if (!isScheduled) {
    return {
      stage,
      label: "",
      subtitle: "",
      dueDate: null,
      isDue: false,
      isOverdue: false,
      isComplete,
      isScheduled: false,
      daysAway: null,
    };
  }

  const fallbackDueDate = nextRevisionAt ?? addDays(anchor, spacedRevisionDays[Math.min(stage, spacedRevisionDays.length - 1)] ?? 1);
  const dueDate = isComplete ? null : fallbackDueDate;
  const daysAway = dueDate ? daysBetween(now, dueDate) : null;
  const dueDaysAway = daysAway ?? Number.POSITIVE_INFINITY;
  const isDue = dueDate ? dueDaysAway <= 0 : false;
  const isOverdue = dueDate ? dueDaysAway < 0 : false;
  const nextStep = spacedRevisionDays[Math.min(stage, spacedRevisionDays.length - 1)];

  return {
    stage,
    label: isComplete ? "Revision complete" : stage === 0 ? "Tomorrow" : `${nextStep} days`,
    subtitle: formatRevisionDueText(daysAway, isDue, isComplete),
    dueDate,
    isDue,
    isOverdue,
    isComplete,
    isScheduled: true,
    daysAway,
  };
}

function getRevisionQueueMeta(problem: Problem, state: RevisionState): RevisionQueueMeta {
  const daysAway = state.daysAway ?? Number.POSITIVE_INFINITY;

  let score = 0;
  let label = "Later";

  if (state.isOverdue) {
    score += 1000 - Math.min(Math.abs(daysAway), 30);
    label = "Overdue";
  } else if (state.isDue) {
    score += daysAway === 0 ? 900 : 850;
    label = daysAway === 0 ? "Due today" : "Due soon";
  } else if (daysAway <= 2) {
    score += 700 - daysAway * 10;
    label = daysAway === 1 ? "Tomorrow" : "Soon";
  } else if (daysAway <= 7) {
    score += 500 - daysAway * 5;
    label = "This week";
  } else {
    score += 200 - Math.min(daysAway, 30);
  }

  score += Math.max(problem.priority, 0) * 8;
  score += problem.isPinned ? 30 : 0;
  score += Math.max(problem.rating ?? 0, 0) * 3;
  score += Math.max(state.stage, 0) * 10;

  return { score, label };
}

function getProblemCategories(problem: Problem): string[] {
  const cats: string[] = [];

  if (problem.tags) {
    for (const tag of problem.tags) {
      const normalized = tag.trim().toLowerCase();
      if (normalized === "must do" || normalized === "must-do" || normalized === "mustdo" || normalized === "⭐") {
        if (!cats.includes("Must Do")) cats.push("Must Do");
      }
      if (normalized === "faang" || normalized === "faang favorite" || normalized === "faang-favorite" || normalized === "🔥") {
        if (!cats.includes("FAANG Favorite")) cats.push("FAANG Favorite");
      }
      if (normalized === "service" || normalized === "service company" || normalized === "service-company-favorite" || normalized === "🟢") {
        if (!cats.includes("Service Company Favorite")) cats.push("Service Company Favorite");
      }
      if (normalized === "gem" || normalized === "hidden gem" || normalized === "hidden-gem" || normalized === "💎") {
        if (!cats.includes("Hidden Gem")) cats.push("Hidden Gem");
      }
      if (normalized === "revision" || normalized === "revision question" || normalized === "revision-question" || normalized === "🚀") {
        if (!cats.includes("Revision Question")) cats.push("Revision Question");
      }
      if (normalized === "pattern" || normalized === "pattern builder" || normalized === "pattern-builder" || normalized === "🧠") {
        if (!cats.includes("Pattern Builder")) cats.push("Pattern Builder");
      }
    }
  }

  const titleLower = problem.title.toLowerCase();
  const patternLower = (problem.pattern || "").toLowerCase();
  const topicLower = (problem.topic?.name || "").toLowerCase();
  const difficulty = problem.difficulty;
  const rating = problem.rating ?? 0;

  // 1. Pattern Builder
  if (
    titleLower.includes("implement") ||
    titleLower.includes("design") ||
    titleLower.includes("basic") ||
    titleLower.includes("structure") ||
    patternLower.includes("basics") ||
    patternLower.includes("template") ||
    titleLower.includes("trie") ||
    patternLower.includes("trie")
  ) {
    if (!cats.includes("Pattern Builder")) cats.push("Pattern Builder");
  }

  // 2. Must Do
  if (
    rating >= 9 ||
    titleLower.includes("two sum") ||
    titleLower.includes("palindrome") ||
    titleLower.includes("reverse integer") ||
    titleLower.includes("climbing stairs") ||
    titleLower.includes("lru cache") ||
    titleLower.includes("merge k sorted")
  ) {
    if (!cats.includes("Must Do")) cats.push("Must Do");
  }

  // 3. FAANG Favorite
  if (
    (difficulty === "Medium" || difficulty === "Hard") &&
    (topicLower.includes("tree") ||
      topicLower.includes("graph") ||
      topicLower.includes("dynamic programming") ||
      topicLower.includes("backtracking") ||
      topicLower.includes("trie") ||
      topicLower.includes("segment") ||
      topicLower.includes("sliding window") ||
      rating >= 9)
  ) {
    if (!cats.includes("FAANG Favorite")) cats.push("FAANG Favorite");
  }

  // 4. Service Company Favorite
  if (
    (difficulty === "Easy" || difficulty === "Medium") &&
    (topicLower.includes("foundation") ||
      topicLower.includes("array") ||
      topicLower.includes("string") ||
      topicLower.includes("hash") ||
      topicLower.includes("math"))
  ) {
    if (rating <= 8) {
      if (!cats.includes("Service Company Favorite")) cats.push("Service Company Favorite");
    }
  }

  // 5. Hidden Gem
  if (
    (rating === 8 || rating === 9) &&
    !cats.includes("Must Do") &&
    (titleLower.includes("stream") ||
      titleLower.includes("map") ||
      titleLower.includes("sum") ||
      titleLower.includes("prefix") ||
      titleLower.includes("suffix"))
  ) {
    if (!cats.includes("Hidden Gem")) cats.push("Hidden Gem");
  }

  // 6. Revision Question
  if (rating >= 9 && (difficulty === "Medium" || difficulty === "Hard")) {
    if (!cats.includes("Revision Question")) cats.push("Revision Question");
  }

  // Fallback so every problem has at least one tag
  if (cats.length === 0) {
    if (difficulty === "Easy") {
      cats.push("Service Company Favorite");
    } else {
      cats.push("Pattern Builder");
    }
  }

  return cats;
}

const ProblemRow = memo(function ProblemRow({
  problem,
  displayIndex,
  canEdit,
  revisionState,
  categories,
  onOpenStudy,
  onToggleStatus,
  onOpenEdit,
  onTogglePin,
  onOpenLink,
  onDelete,
}: ProblemRowProps) {
  const hasNote = Boolean(
    problem.shortNote ||
      problem.longNote ||
      problem.mistakeLog ||
      problem.mistakeTrigger ||
      problem.mistakeReason ||
      problem.mistakeFix
  );

  return (
    <tr className="table-problem-row">
      <td className="status-col">
        <div className="status-cell-content">
          <span className="row-index-num">{displayIndex}</span>
          <button
            type="button"
            className={`status-checkbox ${problem.status === "solved" ? "checked" : ""}`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleStatus(problem, problem.status === "solved" ? "unsolved" : "solved");
            }}
            aria-label="Toggle status"
          >
            {problem.status === "solved" ? <span className="checkbox-inner-dot" /> : null}
          </button>
        </div>
      </td>
      <td className="problem-title-col" onClick={() => onOpenStudy(problem)}>
        <div className="problem-title-wrapper">
          <span className="problem-title-text">{problem.title}</span>
          {problem.pattern ? <span className="pattern-chip">{problem.pattern}</span> : null}
        </div>
      </td>
      <td className="importance-col">
        {problem.rating ? <span className="importance-rating-badge">{formatRating(problem.rating)}</span> : <span className="importance-rating-empty">-</span>}
      </td>
      <td className="practice-col">
        <a
          href={problem.platformUrl}
          target="_blank"
          rel="noreferrer"
          className="practice-platform-link"
          onClick={(event) => event.stopPropagation()}
          title={`Practice on ${problem.platformName}`}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="practice-icon">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </a>
      </td>
      <td className="note-col">
        <button
          className={`table-note-btn ${hasNote ? "has-note" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenEdit(problem);
          }}
          title="Edit Note"
        >
          {hasNote ? (
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="#22c55e" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          )}
        </button>
      </td>
      <td className="revision-col">
        <button
          className={`table-star-btn ${problem.isPinned ? "active" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin(problem);
          }}
          title="Toggle revision star"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            stroke="currentColor"
            strokeWidth="2"
            fill={problem.isPinned ? "#eab308" : "none"}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
      </td>
      <td className="difficulty-col">
        <span className={`difficulty-pill difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
      </td>
      <td className="focus-col">
        <div className="focus-badges">
          {categories.map((cat) => {
            let emoji = "";
            if (cat === "Must Do") emoji = "⭐";
            else if (cat === "FAANG Favorite") emoji = "🔥";
            else if (cat === "Service Company Favorite") emoji = "🟢";
            else if (cat === "Hidden Gem") emoji = "💎";
            else if (cat === "Revision Question") emoji = "🚀";
            else if (cat === "Pattern Builder") emoji = "🧠";

            if (!emoji) return null;
            return (
              <span key={cat} className="focus-badge-icon" title={cat}>
                {emoji}
              </span>
            );
          })}
        </div>
      </td>
      <td className="meaning-col">
        <div className="meaning-badges">
          {categories.map((cat) => {
            let className = "";
            if (cat === "Must Do") className = "badge-must-do";
            else if (cat === "FAANG Favorite") className = "badge-faang";
            else if (cat === "Service Company Favorite") className = "badge-service";
            else if (cat === "Hidden Gem") className = "badge-gem";
            else if (cat === "Revision Question") className = "badge-revision";
            else if (cat === "Pattern Builder") className = "badge-pattern";

            return (
              <span key={cat} className={`meaning-badge ${className}`}>
                {cat}
              </span>
            );
          })}
        </div>
      </td>
      {canEdit ? (
        <td className="delete-col">
          <button
            className="table-delete-btn"
            onClick={(event) => {
              event.stopPropagation();
              if (window.confirm("Are you sure you want to delete this problem?")) {
                onDelete(problem._id);
              }
            }}
          >
            Delete
          </button>
        </td>
      ) : null}
    </tr>
  );
});

const SectionBlock = memo(function SectionBlock({
  group,
  accent,
  canEdit,
  revisionStateMap,
  problemCategoryMap,
  nowDate,
  onOpenStudy,
  onToggleStatus,
  onOpenEdit,
  onTogglePin,
  onOpenLink,
  onDelete,
  rowLimit,
  onLoadMore,
}: SectionBlockProps) {
  const visibleProblems = group.problems.slice(0, rowLimit);
  const hasMore = group.problems.length > rowLimit;

  return (
    <Fragment>
      <tr className="table-section-header-row">
        <td colSpan={canEdit ? 10 : 9} className="table-section-header-cell">
          <div className="section-header-content">
            <span className="expand-arrow-sub" style={{ color: accent }}>•</span>
            <span className="section-name">{group.sectionName}</span>
            <span className="section-stats-badge">
              {group.solvedCount} / {group.totalCount} Solved
            </span>
          </div>
        </td>
      </tr>

      {visibleProblems.map(({ problem, displayIndex }) => (
        <ProblemRow
          key={problem._id}
          problem={problem}
          displayIndex={displayIndex}
          canEdit={canEdit}
          revisionState={revisionStateMap.get(problem._id) ?? getRevisionState(problem, nowDate)}
          categories={problemCategoryMap.get(problem._id) ?? getProblemCategories(problem)}
          onOpenStudy={onOpenStudy}
          onToggleStatus={onToggleStatus}
          onOpenEdit={onOpenEdit}
          onTogglePin={onTogglePin}
          onOpenLink={onOpenLink}
          onDelete={onDelete}
        />
      ))}

      {hasMore ? (
        <tr className="table-load-more-row">
          <td colSpan={canEdit ? 10 : 9}>
            <button className="table-load-more-btn" onClick={() => onLoadMore()}>
              Load more rows
            </button>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
});

declare const __LOGIN_USERNAME__: string;
declare const __LOGIN_PASSWORD__: string;

const AUTH_STORAGE_KEY = "dsa-tracker-authenticated";
const APP_VIEW_STATE_KEY = "dsa-tracker-view-state";
const DEFAULT_LOGIN = {
  username: __LOGIN_USERNAME__.trim(),
  password: __LOGIN_PASSWORD__,
};

type PersistedViewState = {
  search?: string;
  statusFilter?: Status | "all" | "revisit";
  difficultyFilter?: Difficulty | "all";
  selectedTopic?: string;
  selectedProblemSet?: string;
  activeProblemId?: string | null;
  drawerOpen?: boolean;
  drawerMode?: "edit" | "notes";
};

type WorkspaceSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function readPersistedViewState(): PersistedViewState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(APP_VIEW_STATE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as PersistedViewState;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }

  return response.json();
}

export default function App() {
  const loginConfigured = Boolean(DEFAULT_LOGIN.username && DEFAULT_LOGIN.password);
  const persistedViewState = useMemo(() => readPersistedViewState(), []);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
  });
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(persistedViewState.search ?? "");
  const [statusFilter, setStatusFilter] = useState<Status | "all" | "revisit">(persistedViewState.statusFilter ?? "all");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">(persistedViewState.difficultyFilter ?? "all");
  const [selectedTopic, setSelectedTopic] = useState<string>(persistedViewState.selectedTopic ?? "all");
  const [selectedProblemSet, setSelectedProblemSet] = useState<string>(persistedViewState.selectedProblemSet ?? "set1");
  const [drawerOpen, setDrawerOpen] = useState(Boolean(persistedViewState.activeProblemId && persistedViewState.drawerOpen));
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);

  useEffect(() => {
    if (didInitialLoadRef.current) {
      void loadData({ silent: false });
    }
    setSelectedTopic("all");
    setDrawerOpen(false);
    setActiveProblem(null);
  }, [selectedProblemSet]);

  const [drawerMode, setDrawerMode] = useState<"edit" | "notes">(persistedViewState.drawerMode ?? "notes");
  const [editMode, setEditMode] = useState(false);
  const [expandedProblems, setExpandedProblems] = useState<Set<string>>(() => new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(() => new Set());
  const [form, setForm] = useState<ProblemFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [workspaceSaveState, setWorkspaceSaveState] = useState<WorkspaceSaveState>("idle");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [sectionRowLimit, setSectionRowLimit] = useState(20);
  const didInitialLoadRef = useRef(false);
  const restoredViewRef = useRef(false);
  const skipWorkspaceAutosaveRef = useRef(false);
  const workspaceSaveTimerRef = useRef<number | null>(null);
  const deferredSearch = useDeferredValue(search);
  const nowDate = useMemo(() => new Date(now), [now]);

  const selectedTopicData = useMemo(
    () => topics.find((topic) => topic._id === selectedTopic) ?? null,
    [selectedTopic, topics]
  );
  const activeRevisionState = useMemo(
    () => (activeProblem ? getRevisionState(activeProblem, nowDate) : null),
    [activeProblem, nowDate]
  );

  const stats = useMemo(() => {
    const totalProblems = problems.length;
    const solvedProblems = problems.filter((problem) => problem.status === "solved").length;
    const revisitProblems = problems.filter((problem) => problem.status === "revisit").length;
    const unsolvedProblems = problems.filter((problem) => problem.status === "unsolved").length;
    const skippedProblems = problems.filter((problem) => problem.status === "skipped").length;

    return {
      totalProblems,
      solvedProblems,
      revisitProblems,
      unsolvedProblems,
      skippedProblems,
    };
  }, [problems]);

  const visibleStats = useMemo(() => {
    if (selectedTopic === "all") {
      return stats;
    }

    const topicProblems = problems.filter((problem) => problem.topic._id === selectedTopic);
    return {
      totalProblems: topicProblems.length,
      solvedProblems: topicProblems.filter((problem) => problem.status === "solved").length,
      revisitProblems: topicProblems.filter((problem) => problem.status === "revisit").length,
      unsolvedProblems: topicProblems.filter((problem) => problem.status === "unsolved").length,
      skippedProblems: topicProblems.filter((problem) => problem.status === "skipped").length,
    };
  }, [problems, selectedTopic, stats]);

  const activityScopeRecords = useMemo(() => {
    if (selectedTopic === "all") {
      return activities;
    }

    return activities.filter((activity) => activity.topic._id === selectedTopic);
  }, [activities, selectedTopic]);

  const activityInsights = useMemo(
    () => buildActivityInsights(activityScopeRecords, nowDate),
    [activityScopeRecords, nowDate]
  );

  const problemCategoryMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const problem of problems) {
      map.set(problem._id, getProblemCategories(problem));
    }
    return map;
  }, [problems]);

  const revisionStateMap = useMemo(() => {
    const map = new Map<string, RevisionState>();
    for (const problem of problems) {
      map.set(problem._id, getRevisionState(problem, nowDate));
    }
    return map;
  }, [nowDate, problems]);

  const handleSilentRefresh = useCallback(async () => {
    try {
      const [topicsRes, problemsRes, activitiesRes] = await Promise.all([
        api<{ topics: Topic[] }>(`/api/topics?set=${selectedProblemSet}`),
        api<{ problems: Problem[] }>(`/api/problems?brief=1&set=${selectedProblemSet}`),
        api<{ activities: ActivityRecord[] }>(`/api/activity?limit=5000&set=${selectedProblemSet}`),
      ]);
      setTopics(topicsRes.topics);
      setProblems(problemsRes.problems);
      setActivities(activitiesRes.activities);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, [selectedProblemSet]);

  async function loadData(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      setError("");
      await handleSilentRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const upsertProblem = useCallback((updatedProblem: Problem) => {
    setProblems((current) =>
      current.map((problem) => (problem._id === updatedProblem._id ? updatedProblem : problem))
    );
  }, []);

  const appendProblem = useCallback((updatedProblem: Problem) => {
    setProblems((current) => [updatedProblem, ...current.filter((problem) => problem._id !== updatedProblem._id)]);
  }, []);

  const removeProblem = useCallback((problemId: string) => {
    setProblems((current) => current.filter((problem) => problem._id !== problemId));
  }, []);

  const openProblemLink = useCallback((problem: Problem) => {
    window.open(problem.platformUrl, "_blank", "noopener,noreferrer");
  }, []);

  const hydrateProblemDetails = useCallback(async (problem: Problem) => {
    if (problem.longNote !== undefined && problem.tags.length > 0) {
      return problem;
    }

    const response = await api<{ problem: Problem }>(`/api/problems/${problem._id}`);
    upsertProblem(response.problem);
    return response.problem;
  }, [upsertProblem]);

  useEffect(() => {
    if (!isAuthenticated) {
      didInitialLoadRef.current = false;
      return;
    }

    if (didInitialLoadRef.current) {
      return;
    }

    didInitialLoadRef.current = true;

    void loadData({
      silent: topics.length > 0 || problems.length > 0,
    });
  }, [isAuthenticated]);

  useEffect(() => {
    let timer: number | undefined;

    const scheduleNextUpdate = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      timer = window.setTimeout(() => {
        setNow(Date.now());
        scheduleNextUpdate();
      }, nextMidnight.getTime() - now.getTime());
    };

    scheduleNextUpdate();

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") {
      return;
    }

    const nextState: PersistedViewState = {
      search,
      statusFilter,
      difficultyFilter,
      selectedTopic,
      selectedProblemSet,
      activeProblemId: activeProblem?._id ?? null,
      drawerOpen,
      drawerMode,
    };

    window.localStorage.setItem(APP_VIEW_STATE_KEY, JSON.stringify(nextState));
  }, [activeProblem?._id, difficultyFilter, drawerMode, drawerOpen, isAuthenticated, search, selectedTopic, selectedProblemSet, statusFilter]);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!loginConfigured) {
      setLoginError("Set USERNAME and PASSWORD in your .env file.");
      return;
    }

    if (
      loginForm.username.trim() === DEFAULT_LOGIN.username &&
      loginForm.password === DEFAULT_LOGIN.password
    ) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
      setLoginError("");
      setIsAuthenticated(true);
      return;
    }

    setLoginError("Invalid username or password.");
  }

  function handleLogout() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
    setLoginError("");
    setError("");
    setSearch("");
    setStatusFilter("all");
    setDifficultyFilter("all");
    setSelectedTopic("all");
    setDrawerOpen(false);
    setActiveProblem(null);
    setDrawerMode("notes");
    setExpandedProblems(new Set());
    setExpandedTopics(new Set());
    setForm(emptyForm);
    setSectionRowLimit(30);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(APP_VIEW_STATE_KEY);
    }
  }

  const filteredProblems = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return problems.filter((problem) => {
      const categories = problemCategoryMap.get(problem._id) ?? getProblemCategories(problem);
      const matchesTopic = selectedTopic === "all" || problem.topic._id === selectedTopic;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "revisit"
          ? problem.isPinned
          : problem.status === statusFilter;
      const matchesDifficulty =
        difficultyFilter === "all" || problem.difficulty === difficultyFilter;
      const matchesSearch =
        !needle ||
        [
          problem.title,
          problem.platformName,
          problem.roadmapSection,
          problem.pattern,
          problem.shortNote,
          problem.longNote,
          ...problem.tags,
          ...categories,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return matchesTopic && matchesStatus && matchesDifficulty && matchesSearch;
    });
  }, [deferredSearch, difficultyFilter, problemCategoryMap, problems, selectedTopic, statusFilter]);

  const sortedFilteredProblems = useMemo(() => {
    return [...filteredProblems].sort((left, right) => {
      if (statusFilter === "revisit") {
        const leftRevision = revisionStateMap.get(left._id) ?? getRevisionState(left, nowDate);
        const rightRevision = revisionStateMap.get(right._id) ?? getRevisionState(right, nowDate);

        const leftRevisionScore = leftRevision.isOverdue ? 3 : leftRevision.isDue ? 2 : leftRevision.isScheduled ? 1 : 0;
        const rightRevisionScore = rightRevision.isOverdue ? 3 : rightRevision.isDue ? 2 : rightRevision.isScheduled ? 1 : 0;
        const revisionScoreDelta = rightRevisionScore - leftRevisionScore;
        if (revisionScoreDelta !== 0) {
          return revisionScoreDelta;
        }

        const leftDue = leftRevision.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        const rightDue = rightRevision.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        if (leftDue !== rightDue) {
          return leftDue - rightDue;
        }
      }

      if (selectedTopic === "all") {
        const topicOrderDelta = left.topic.order - right.topic.order;
        if (topicOrderDelta !== 0) {
          return topicOrderDelta;
        }
      }

      const sectionOrderDelta = (left.roadmapSectionOrder ?? 999) - (right.roadmapSectionOrder ?? 999);
      if (sectionOrderDelta !== 0) {
        return sectionOrderDelta;
      }

      const roadmapOrderDelta = (left.roadmapOrder ?? 999) - (right.roadmapOrder ?? 999);
      if (roadmapOrderDelta !== 0) {
        return roadmapOrderDelta;
      }

      const priorityDelta = right.priority - left.priority;
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left.title.localeCompare(right.title);
    });
  }, [filteredProblems, nowDate, revisionStateMap, selectedTopic, statusFilter]);

  const groupedByTopicAndSection = useMemo(() => {
    const topicGroups: Array<{
      topicId: string;
      topicName: string;
      accent: string;
      solvedCount: number;
      totalCount: number;
      sections: Array<{
        sectionKey: string;
        sectionName: string;
        solvedCount: number;
        totalCount: number;
        problems: Array<{ problem: Problem; displayIndex: number }>;
      }>;
    }> = [];
    const topicGroupsByKey = new Map<string, typeof topicGroups[number]>();
    let displayIndex = 1;

    for (const problem of sortedFilteredProblems) {
      const topicId = problem.topic._id;
      const topicName = problem.topic.name;
      const accent = problem.topic.accent;

      let topicGroup = topicGroupsByKey.get(topicId);
      if (!topicGroup) {
        topicGroup = {
          topicId,
          topicName,
          accent,
          solvedCount: 0,
          totalCount: 0,
          sections: [],
        };
        topicGroups.push(topicGroup);
        topicGroupsByKey.set(topicId, topicGroup);
      }

      const sectionName = problem.roadmapSection?.trim() || "General";
      const sectionOrder = problem.roadmapSectionOrder ?? 999;
      // sectionKey is unique across the app using topicId and section name
      const sectionKey = `${topicId}:${sectionOrder}:${sectionName}`;

      let sectionGroup = topicGroup.sections.find((s) => s.sectionKey === sectionKey);
      if (!sectionGroup) {
        sectionGroup = {
          sectionKey,
          sectionName,
          solvedCount: 0,
          totalCount: 0,
          problems: [],
        };
        topicGroup.sections.push(sectionGroup);
      }

      sectionGroup.problems.push({ problem, displayIndex });
      sectionGroup.totalCount += 1;
      topicGroup.totalCount += 1;
      if (problem.status === "solved") {
        sectionGroup.solvedCount += 1;
        topicGroup.solvedCount += 1;
      }
      displayIndex += 1;
    }

    return topicGroups;
  }, [sortedFilteredProblems]);

  const workspaceProblemIds = useMemo(
    () => sortedFilteredProblems.map((problem) => problem._id),
    [sortedFilteredProblems]
  );

  const activeWorkspaceIndex = useMemo(() => {
    if (!activeProblem) {
      return -1;
    }

    return workspaceProblemIds.indexOf(activeProblem._id);
  }, [activeProblem, workspaceProblemIds]);

  const previousWorkspaceProblem = useMemo(() => {
    if (activeWorkspaceIndex <= 0) {
      return null;
    }

    return sortedFilteredProblems[activeWorkspaceIndex - 1] ?? null;
  }, [activeWorkspaceIndex, sortedFilteredProblems]);

  const nextWorkspaceProblem = useMemo(() => {
    if (activeWorkspaceIndex < 0 || activeWorkspaceIndex >= sortedFilteredProblems.length - 1) {
      return null;
    }

    return sortedFilteredProblems[activeWorkspaceIndex + 1] ?? null;
  }, [activeWorkspaceIndex, sortedFilteredProblems]);

  const hasWorkspaceDraftChanges = useMemo(() => {
    if (!activeProblem || drawerOpen) {
      return false;
    }

    const baselineTrigger = activeProblem.mistakeTrigger ?? splitMistakeLog(activeProblem.mistakeLog).trigger;
    const baselineReason = activeProblem.mistakeReason ?? splitMistakeLog(activeProblem.mistakeLog).reason;
    const baselineFix = activeProblem.mistakeFix ?? splitMistakeLog(activeProblem.mistakeLog).fix;

    return (
      form.shortNote !== (activeProblem.shortNote ?? "") ||
      form.longNote !== (activeProblem.longNote ?? "") ||
      form.mistakeTrigger !== baselineTrigger ||
      form.mistakeReason !== baselineReason ||
      form.mistakeFix !== baselineFix
    );
  }, [
    activeProblem,
    drawerOpen,
    form.longNote,
    form.mistakeFix,
    form.mistakeReason,
    form.mistakeTrigger,
    form.shortNote,
  ]);

  const revisionProblems = useMemo(
    () => problems.filter((problem) => {
      const state = revisionStateMap.get(problem._id) ?? getRevisionState(problem, nowDate);
      return state.isScheduled && !state.isComplete;
    }),
    [nowDate, problems, revisionStateMap]
  );

  const dueRevisionProblems = useMemo(() => {
    return [...revisionProblems]
      .map((problem) => ({ problem, state: revisionStateMap.get(problem._id) ?? getRevisionState(problem, nowDate) }))
      .filter(({ state }) => state.isDue || state.isOverdue)
      .sort((left, right) => {
        const leftMeta = getRevisionQueueMeta(left.problem, left.state);
        const rightMeta = getRevisionQueueMeta(right.problem, right.state);
        if (rightMeta.score !== leftMeta.score) {
          return rightMeta.score - leftMeta.score;
        }

        const leftTime = left.state.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        const rightTime = right.state.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        return leftTime - rightTime;
      })
      .slice(0, 4);
  }, [nowDate, revisionProblems, revisionStateMap]);

  const sidebarRevisionProblems = useMemo(() => {
    return [...revisionProblems]
      .map((problem) => ({ problem, state: revisionStateMap.get(problem._id) ?? getRevisionState(problem, nowDate) }))
      .filter(({ state }) => !state.isDue && !state.isOverdue && !state.isComplete && state.dueDate)
      .sort((left, right) => {
        const leftMeta = getRevisionQueueMeta(left.problem, left.state);
        const rightMeta = getRevisionQueueMeta(right.problem, right.state);
        if (rightMeta.score !== leftMeta.score) {
          return rightMeta.score - leftMeta.score;
        }

        const leftTime = left.state.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        const rightTime = right.state.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        return leftTime - rightTime;
      })
      .slice(0, 8);
  }, [nowDate, revisionProblems, revisionStateMap]);

  const toggleTopicExpanded = useCallback((topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }, []);

  const focusTopicList = useCallback((topicId: string, nextStatus: Status | "all" | "revisit") => {
    setActiveProblem(null);
    setDrawerOpen(false);
    setSelectedTopic(topicId);
    setStatusFilter(nextStatus);
    setMobileSidebarOpen(false);
  }, []);

  const openAddDrawer = useCallback((topicId?: string) => {
    setActiveProblem(null);
    setDrawerMode("edit");
    setForm({
      ...emptyForm,
      topicId: topicId ?? (selectedTopic !== "all" ? selectedTopic : topics[0]?._id ?? ""),
      roadmapSection: selectedTopicData?.name ?? "",
    });
    setDrawerOpen(true);
  }, [selectedTopic, selectedTopicData?.name, topics]);

  const syncFormFromProblem = useCallback((problem: Problem) => {
    skipWorkspaceAutosaveRef.current = true;
    setForm({
      title: problem.title,
      topicId: problem.topic._id,
      roadmapSection: problem.roadmapSection ?? "",
      platformName: problem.platformName,
      platformUrl: problem.platformUrl,
      difficulty: problem.difficulty,
      status: problem.status,
      pattern: problem.pattern ?? "",
      invariant: problem.invariant ?? "",
      compareBruteForce: problem.compareBruteForce ?? "",
      compareOptimized: problem.compareOptimized ?? "",
      compareWhyBetter: problem.compareWhyBetter ?? "",
      rating: problem.rating ?? 0,
      shortNote: problem.shortNote,
      longNote: problem.longNote ?? "",
      mistakeLog: problem.mistakeLog ?? composeMistakeLog(problem.mistakeTrigger ?? "", problem.mistakeReason ?? "", problem.mistakeFix ?? ""),
      mistakeTrigger: problem.mistakeTrigger ?? splitMistakeLog(problem.mistakeLog).trigger,
      mistakeReason: problem.mistakeReason ?? splitMistakeLog(problem.mistakeLog).reason,
      mistakeFix: problem.mistakeFix ?? splitMistakeLog(problem.mistakeLog).fix,
      tags: problem.tags.join(", "),
      priority: problem.priority,
      isPinned: problem.isPinned,
    });
    setWorkspaceSaveState("idle");
  }, []);

  const openStudyView = useCallback((problem: Problem) => {
    setActiveProblem(problem);
    syncFormFromProblem(problem);
    void hydrateProblemDetails(problem).then((nextProblem) => {
      setActiveProblem(nextProblem);
      syncFormFromProblem(nextProblem);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load problem details");
    });
  }, [hydrateProblemDetails, syncFormFromProblem]);

  const openEditDrawer = useCallback((problem: Problem) => {
    setActiveProblem(problem);
    setDrawerMode("edit");
    syncFormFromProblem(problem);
    setDrawerOpen(true);
    void hydrateProblemDetails(problem).then((nextProblem) => {
      setActiveProblem(nextProblem);
      syncFormFromProblem(nextProblem);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load problem details");
    });
  }, [hydrateProblemDetails, syncFormFromProblem]);

  const openProblemDrawer = useCallback((problem: Problem) => {
    openStudyView(problem);
  }, [openStudyView]);

  const saveProblem = useCallback(async (options?: { keepWorkspaceOpen?: boolean }) => {
    if (!form.title.trim() || !form.topicId || !form.platformName.trim() || !form.platformUrl.trim()) {
      setError("Title, topic, platform name, and platform link are required.");
      setWorkspaceSaveState("error");
      return;
    }

    try {
      setSaving(true);
      setWorkspaceSaveState("saving");
      setError("");
      const payload = {
        title: form.title.trim(),
        topicId: form.topicId,
        roadmapSection: form.roadmapSection.trim(),
        platformName: form.platformName.trim(),
        platformUrl: form.platformUrl.trim(),
        difficulty: form.difficulty,
        status: form.status,
        pattern: form.pattern.trim(),
        invariant: form.invariant.trim(),
        compareBruteForce: form.compareBruteForce.trim(),
        compareOptimized: form.compareOptimized.trim(),
        compareWhyBetter: form.compareWhyBetter.trim(),
        rating: form.rating,
        shortNote: form.shortNote.trim(),
        longNote: form.longNote.trim(),
        mistakeTrigger: form.mistakeTrigger.trim(),
        mistakeReason: form.mistakeReason.trim(),
        mistakeFix: form.mistakeFix.trim(),
        mistakeLog: composeMistakeLog(form.mistakeTrigger, form.mistakeReason, form.mistakeFix),
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        priority: form.priority,
        isPinned: form.isPinned,
      };

      if (activeProblem) {
        const response = await api<{ problem: Problem }>(`/api/problems/${activeProblem._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        upsertProblem(response.problem);
        setActiveProblem(response.problem);
        syncFormFromProblem(response.problem);
      } else {
        const response = await api<{ problem: Problem }>("/api/problems", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        appendProblem(response.problem);
        setActiveProblem(response.problem);
        syncFormFromProblem(response.problem);
      }

      if (drawerOpen) {
        setDrawerOpen(false);
      }

      if (!activeProblem && !options?.keepWorkspaceOpen) {
        setForm(emptyForm);
      }
      void loadData({ silent: true });
      setWorkspaceSaveState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save problem");
      setWorkspaceSaveState("error");
    } finally {
      setSaving(false);
    }
  }, [activeProblem, appendProblem, drawerOpen, form, setError, setSaving, setDrawerOpen, setActiveProblem, setForm, syncFormFromProblem, upsertProblem]);

  useEffect(() => {
    if (!activeProblem || drawerOpen) {
      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current);
        workspaceSaveTimerRef.current = null;
      }
      return;
    }

    if (skipWorkspaceAutosaveRef.current) {
      skipWorkspaceAutosaveRef.current = false;
      return;
    }

    const baselineShortNote = activeProblem.shortNote ?? "";
    const baselineLongNote = activeProblem.longNote ?? "";
    const baselineTrigger = activeProblem.mistakeTrigger ?? splitMistakeLog(activeProblem.mistakeLog).trigger;
    const baselineReason = activeProblem.mistakeReason ?? splitMistakeLog(activeProblem.mistakeLog).reason;
    const baselineFix = activeProblem.mistakeFix ?? splitMistakeLog(activeProblem.mistakeLog).fix;

    const hasWorkspaceChanges =
      form.shortNote !== baselineShortNote ||
      form.longNote !== baselineLongNote ||
      form.mistakeTrigger !== baselineTrigger ||
      form.mistakeReason !== baselineReason ||
      form.mistakeFix !== baselineFix;

    if (!hasWorkspaceChanges) {
      setWorkspaceSaveState((current) => (current === "saving" ? current : "idle"));
      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current);
        workspaceSaveTimerRef.current = null;
      }
      return;
    }

    setWorkspaceSaveState("dirty");
    if (workspaceSaveTimerRef.current !== null) {
      window.clearTimeout(workspaceSaveTimerRef.current);
    }

    workspaceSaveTimerRef.current = window.setTimeout(() => {
      void saveProblem({ keepWorkspaceOpen: true });
      workspaceSaveTimerRef.current = null;
    }, 900);

    return () => {
      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current);
        workspaceSaveTimerRef.current = null;
      }
    };
  }, [
    activeProblem,
    drawerOpen,
    form.longNote,
    form.mistakeFix,
    form.mistakeReason,
    form.mistakeTrigger,
    form.shortNote,
    saveProblem,
  ]);

  useEffect(() => {
    if (workspaceSaveState !== "saved") {
      return;
    }

    const timer = window.setTimeout(() => {
      setWorkspaceSaveState("idle");
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [workspaceSaveState]);

  useEffect(() => {
    if (!isAuthenticated || restoredViewRef.current || problems.length === 0) {
      return;
    }

    restoredViewRef.current = true;
    const activeProblemId = persistedViewState.activeProblemId;
    if (!activeProblemId) {
      return;
    }

    const matchedProblem = problems.find((problem) => problem._id === activeProblemId);
    if (!matchedProblem) {
      return;
    }

    if (persistedViewState.drawerOpen) {
      if (persistedViewState.drawerMode === "edit") {
        openEditDrawer(matchedProblem);
      } else {
        setActiveProblem(matchedProblem);
        setDrawerMode("notes");
        setDrawerOpen(true);
        syncFormFromProblem(matchedProblem);
        void hydrateProblemDetails(matchedProblem).then((nextProblem) => {
          setActiveProblem(nextProblem);
          syncFormFromProblem(nextProblem);
        }).catch((err) => {
          setError(err instanceof Error ? err.message : "Could not load problem details");
        });
      }
      return;
    }

    openStudyView(matchedProblem);
  }, [
    hydrateProblemDetails,
    isAuthenticated,
    openEditDrawer,
    openStudyView,
    persistedViewState.activeProblemId,
    persistedViewState.drawerMode,
    persistedViewState.drawerOpen,
    problems,
    syncFormFromProblem,
  ]);

  const toggleProblemExpanded = useCallback((problemId: string) => {
    setExpandedProblems((current) => {
      const next = new Set(current);
      if (next.has(problemId)) {
        next.delete(problemId);
      } else {
        next.add(problemId);
      }

      return next;
    });
  }, []);

  const updateStatus = useCallback(async (problem: Problem, nextStatus: Status) => {
    try {
      const response = await api<{ problem: Problem }>(`/api/problems/${problem._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      upsertProblem(response.problem);
      if (activeProblem?._id === problem._id) {
        setActiveProblem(response.problem);
      }
      void loadData({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    }
  }, [activeProblem, setError, setActiveProblem, upsertProblem]);

  const completeRevision = useCallback(async (problem: Problem) => {
    try {
      const response = await api<{ problem: Problem }>(`/api/problems/${problem._id}/revision`, {
        method: "POST",
      });
      upsertProblem(response.problem);
      if (activeProblem?._id === problem._id) {
        setActiveProblem(response.problem);
      }
      void loadData({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update revision schedule");
    }
  }, [activeProblem, setError, setActiveProblem, upsertProblem]);

  const deleteProblem = useCallback(async (problemId: string) => {
    try {
      await api(`/api/problems/${problemId}`, { method: "DELETE" });
      removeProblem(problemId);
      if (activeProblem?._id === problemId) {
        setDrawerOpen(false);
        setActiveProblem(null);
      }
      void loadData({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete problem");
    }
  }, [activeProblem, removeProblem, setDrawerOpen, setActiveProblem, setError]);

  const togglePin = useCallback(async (problem: Problem) => {
    try {
      const response = await api<{ problem: Problem }>(`/api/problems/${problem._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPinned: !problem.isPinned }),
      });
      upsertProblem(response.problem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not toggle pin");
    }
  }, [setError, upsertProblem]);

  const progress = stats && stats.totalProblems > 0 ? Math.round((stats.solvedProblems / stats.totalProblems) * 100) : 0;
  const visibleProgress =
    visibleStats && visibleStats.totalProblems > 0
      ? Math.round((visibleStats.solvedProblems / visibleStats.totalProblems) * 100)
      : 0;

  const authView = (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="brand auth-brand">
          <div className="brand-mark">DSA</div>
          <div>
            <h1>Tracker</h1>
            <p>Private DSA practice board with a simple login gate.</p>
          </div>
        </div>

        <div className="auth-copy">
          <p className="eyebrow">Welcome back</p>
          <h2>Log in.</h2>
          <p className="hero-copy">Use your `.env` values.</p>
          {!loginConfigured ? (
            <div className="banner error">
              Set <code>USERNAME</code> and <code>PASSWORD</code> in your{" "}
              <code>.env</code> file to enable sign in.
            </div>
          ) : null}
        </div>
      </section>

      <section className="auth-card">
        <p className="panel-label">Secure access</p>
        <h3>Sign in</h3>
        <p className="auth-note">Local login only.</p>

        <form className="auth-form" onSubmit={handleLogin}>
          <label>
            Username
            <input
              value={loginForm.username}
              onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
              autoComplete="username"
              placeholder="name@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              autoComplete="current-password"
              placeholder="Password"
            />
          </label>

          {loginError ? <div className="banner error">{loginError}</div> : null}

          <button className="primary-btn auth-submit" type="submit">
            Enter Tracker
          </button>
        </form>
      </section>
    </main>
  );

  const dashboardView = (
    <div className="app-shell">
      {/* Sticky Mobile Top Bar */}
      <header className="mobile-header">
        <button className="menu-btn" onClick={() => setMobileSidebarOpen(true)} aria-label="Open menu">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <span className="mobile-title">DSA Tracker</span>
        <div className="mobile-header-actions">
          <button className="icon-btn" onClick={() => void loadData()} title="Refresh">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* Sidebar Backdrop Overlay on Mobile */}
      {mobileSidebarOpen ? (
        <div className="sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
      ) : null}

      <aside className={`sidebar ${mobileSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header-mobile">
          <span className="sidebar-mobile-title">Topics</span>
          <button className="close-btn" onClick={() => setMobileSidebarOpen(false)} aria-label="Close menu">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="brand">
          <div className="brand-mark">DSA</div>
          <div>
            <h1>Tracker</h1>
            <p>Problems and notes.</p>
          </div>
        </div>

        <div style={{ padding: "0 1rem", marginBottom: "1rem", marginTop: "-0.5rem" }}>
          <select
            value={selectedProblemSet}
            onChange={(e) => setSelectedProblemSet(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--color-text)",
              outline: "none",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            <option value="set1">Main List (Set 1)</option>
            <option value="set2">Problem Set 2</option>
            <option value="set3">Problem Set 3</option>
          </select>
        </div>

        <button
          className={`topic-card all-topics ${selectedTopic === "all" ? "active" : ""}`}
          onClick={() => focusTopicList("all", "all")}
        >
          <div>
            <span className="topic-name">All Topics</span>
            <span className="topic-subtitle">{problems.length} records</span>
          </div>
          <span className="topic-count">{problems.length}</span>
        </button>

        <button
          className={`topic-card ${statusFilter === "revisit" ? "active" : ""}`}
          onClick={() => focusTopicList("all", "revisit")}
        >
          <div className="topic-dot revision-dot" />
          <div className="topic-copy">
            <span className="topic-name">Revisit</span>
            <span className="topic-subtitle">{sidebarRevisionProblems.length} pending</span>
          </div>
          <span className="topic-count">{sidebarRevisionProblems.length}</span>
        </button>

        <div className="topic-list">
          {topics.map((topic) => {
            const active = selectedTopic === topic._id;
            const solved = topic.solvedCount ?? 0;
            const total = topic.totalProblems ?? 0;
            const slug = topic.slug;
            const subCategories = topicSubCategories[slug] ?? [];
            return (
              <div key={topic._id} className="sidebar-topic-group">
                <button
                  className={`topic-card ${active ? "active" : ""}`}
                  onClick={() => focusTopicList(topic._id, "all")}
                >
                  <div className="topic-dot" style={{ background: topic.accent }} />
                  <div className="topic-copy">
                    <span className="topic-name">{topic.name}</span>
                    <span className="topic-subtitle">
                      {solved}/{total || topic.targetCount} done
                    </span>
                  </div>
                  <span className="topic-count">{topic.targetCount}</span>
                </button>
                {subCategories.length > 0 ? (
                  <div className="topic-subcategory-list" aria-label={`${topic.name} subtopics`}>
                    {subCategories.map((sub) => (
                      <div key={sub.id} className="topic-subcategory-item">
                        {sub.label}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

      </aside>

      <main className="content">
        <section className="hero">
          <div>
            <p className="eyebrow">DSA Tracker</p>
            <h2>Track problems. Add notes.</h2>
            <p className="hero-copy">Simple and clean.</p>
          </div>

          <div className="hero-actions">
            <button className="primary-btn" onClick={() => openAddDrawer()}>
              Add
            </button>
            <button
              className={`secondary-btn ${editMode ? "active" : ""}`}
              onClick={() => setEditMode((value) => !value)}
            >
              {editMode ? "Edit on" : "Edit off"}
            </button>
            <button className="secondary-btn" onClick={() => void loadData()}>
              Refresh
            </button>
            <button className="ghost-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </section>


        {error ? <div className="banner error">{error}</div> : null}

        <section className="stats-grid">
          <StatCard
            label="Total"
            value={visibleStats?.totalProblems ?? 0}
            hint={selectedTopic === "all" ? "All records" : "Topic records"}
          />
          <StatCard
            label="Solved"
            value={visibleStats?.solvedProblems ?? 0}
            hint={`${visibleProgress}% complete`}
          />
          <StatCard
            label="Revisit"
            value={visibleStats?.revisitProblems ?? 0}
            hint={selectedTopic === "all" ? "Needs another pass" : "Topic revisit"}
          />
          <StatCard
            label="Unsolved"
            value={visibleStats?.unsolvedProblems ?? 0}
            hint={selectedTopic === "all" ? "Still pending" : "Topic pending"}
          />
        </section>

        {selectedTopic === "all" ? (
          <section className="progress-panel">
            <div>
              <p className="panel-label">Overall progress</p>
              <h3>{progress}% solved</h3>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-meta">
              <span>{stats?.solvedProblems ?? 0} solved</span>
              <span>{stats?.revisitProblems ?? 0} revisit</span>
              <span>{stats?.unsolvedProblems ?? 0} unsolved</span>
            </div>
          </section>
        ) : null}

        <ActivityInsightsPanel
          insights={activityInsights}
          scopeLabel={selectedTopicData?.name ?? "All topics"}
          onOpenProblem={(problemId) => {
            const matchedProblem = problems.find((problem) => problem._id === problemId);
            if (matchedProblem) {
              openStudyView(matchedProblem);
            }
          }}
          onCompleteRevision={(problemId) => {
            const matchedProblem = problems.find((problem) => problem._id === problemId);
            if (matchedProblem) {
              void completeRevision(matchedProblem);
            }
          }}
          onFilterTopic={(topicId) => focusTopicList(topicId, "all")}
        />

        {statusFilter === "revisit" && revisionProblems.length > 0 ? (
          <section className="revision-panel">
            <div className="section-heading revision-heading">
              <div>
              <p className="panel-label">Spaced repetition</p>
                <h3>{dueRevisionProblems.length} due now</h3>
              </div>
              <span className="section-note">{revisionProblems.length} scheduled for revisit</span>
            </div>

            <div className="revision-grid">
              <div className="revision-stack">
                <p className="revision-stack-label">Due now</p>
                <div className="revision-list">
                  {dueRevisionProblems.length > 0 ? (
                    dueRevisionProblems.map(({ problem, state }) => (
                      <article key={problem._id} className={`revision-item ${state.isOverdue ? "overdue" : "due"}`}>
                        <button
                          className={`revision-check ${state.isComplete ? "checked" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void completeRevision(problem);
                          }}
                          aria-label="Mark revision complete"
                          title="Mark done"
                        >
                          {state.isComplete ? "✓" : ""}
                        </button>
                        <div className="revision-item-copy">
                          <strong>{problem.title}</strong>
                          <span>{state.subtitle}</span>
                        </div>
                        <span className="revision-priority-pill">
                          {getRevisionQueueMeta(problem, state).label}
                        </span>
                        <button className="revision-action" onClick={() => openProblemLink(problem)}>
                          Revise
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="revision-empty">No revision is due right now.</div>
                  )}
                </div>
              </div>

              <div className="revision-stack">
                <p className="revision-stack-label">Next up</p>
                <div className="revision-list">
                  {sidebarRevisionProblems.length > 0 ? (
                    sidebarRevisionProblems.map(({ problem, state }) => (
                      <article key={problem._id} className="revision-item upcoming">
                        <div className="revision-item-copy">
                          <strong>{problem.title}</strong>
                          <span>{state.subtitle}</span>
                        </div>
                        <span className="revision-priority-pill subtle">
                          {getRevisionQueueMeta(problem, state).label}
                        </span>
                        <button className="revision-action ghost" onClick={() => openStudyView(problem)}>
                          Open
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="revision-empty">No upcoming revisions scheduled.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="revision-summary-strip">
              <span>{revisionProblems.length} items in revisit queue</span>
              <span>{dueRevisionProblems.length} due now</span>
              <span>{sidebarRevisionProblems.length} upcoming</span>
            </div>
          </section>
        ) : null}

        {activeProblem && !drawerOpen ? (
          <section className="problem-workspace">
            <div className="problem-workspace-head">
              <div>
                <p className="panel-label">
                  <SectionBadge icon="🧩" label="Problem workspace" tone="sky" />
                </p>
                <h3>{activeProblem.title}</h3>
                <p className="section-note">
                  {activeProblem.topic.name} · {activeProblem.platformName} · {activeProblem.difficulty}
                </p>
                <p className={`workspace-save-indicator workspace-save-${workspaceSaveState}`}>
                  {workspaceSaveState === "dirty"
                    ? "Unsaved changes"
                    : workspaceSaveState === "saving"
                    ? "Saving..."
                    : workspaceSaveState === "saved"
                    ? "Saved"
                    : workspaceSaveState === "error"
                    ? "Save failed"
                    : "Autosave on"}
                </p>
              </div>

              <div className="problem-workspace-actions">
                <span className="workspace-nav-meta">
                  {activeWorkspaceIndex >= 0 ? `${activeWorkspaceIndex + 1} / ${workspaceProblemIds.length}` : "Workspace"}
                </span>
                <button
                  className="secondary-btn"
                  disabled={!previousWorkspaceProblem}
                  onClick={() => {
                    if (previousWorkspaceProblem) {
                      openStudyView(previousWorkspaceProblem);
                    }
                  }}
                >
                  Previous
                </button>
                <button
                  className="secondary-btn"
                  disabled={!nextWorkspaceProblem}
                  onClick={() => {
                    if (nextWorkspaceProblem) {
                      openStudyView(nextWorkspaceProblem);
                    }
                  }}
                >
                  Next
                </button>
                <button className="secondary-btn" onClick={() => setActiveProblem(null)}>
                  Back to list
                </button>
                <button className="secondary-btn" onClick={() => openProblemLink(activeProblem)}>
                  Practice
                </button>
                <button className="secondary-btn" onClick={() => openEditDrawer(activeProblem)}>
                  Full edit
                </button>
                <button className="primary-btn" disabled={saving} onClick={() => void saveProblem()}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>

            <div className="problem-workspace-grid">
              <div className="problem-workspace-main">
                <ProblemSummaryPanel problem={activeProblem} />

                <div className="pattern-invariant-card">
                  <p className="panel-label">
                    <SectionBadge icon="🧠" label="Pattern + invariant" tone="sky" />
                  </p>
                  <div className="pattern-invariant-grid">
                    <div>
                      <span className="pattern-invariant-label">Pattern</span>
                      <strong>{activeProblem.pattern?.trim() || "Not set yet"}</strong>
                    </div>
                    <div>
                      <span className="pattern-invariant-label">Invariant</span>
                      <strong>{activeProblem.invariant?.trim() || "Not set yet"}</strong>
                    </div>
                  </div>
                </div>

                <div className="compare-approaches-card">
                  <p className="panel-label">
                    <SectionBadge icon="⚡" label="Compare approaches" tone="rose" />
                  </p>
                  <div className="compare-approaches-grid">
                    <div>
                      <span className="compare-label">Brute force</span>
                      <strong>{activeProblem.compareBruteForce?.trim() || "Not set yet"}</strong>
                    </div>
                    <div>
                      <span className="compare-label">Optimized</span>
                      <strong>{activeProblem.compareOptimized?.trim() || "Not set yet"}</strong>
                    </div>
                    <div>
                      <span className="compare-label">Why better</span>
                      <strong>{activeProblem.compareWhyBetter?.trim() || "Not set yet"}</strong>
                    </div>
                  </div>
                </div>

                <section className="mistake-log-block">
                  <p className="panel-label">
                    <SectionBadge icon="📝" label="Notes" tone="amber" />
                  </p>
                  <div className="workspace-editor-grid">
                    <label className="workspace-editor-field">
                      <span className="study-note-label">Short note</span>
                      <input
                        value={form.shortNote}
                        onChange={(event) => setForm({ ...form, shortNote: event.target.value })}
                        placeholder="One-line takeaway"
                      />
                    </label>
                    <label className="workspace-editor-field">
                      <span className="study-note-label">Detailed notes</span>
                      <textarea
                        rows={7}
                        value={form.longNote}
                        onChange={(event) => setForm({ ...form, longNote: event.target.value })}
                        placeholder="Write the explanation, key insight, or edge cases here"
                      />
                    </label>
                  </div>
                </section>

                <section className="mistake-log-block">
                  <p className="panel-label">
                    <SectionBadge icon="🚧" label="Mistake log" tone="gold" />
                  </p>
                  <div className="workspace-editor-grid">
                    <label className="workspace-editor-field">
                      <span className="study-note-label">What went wrong</span>
                      <textarea
                        rows={3}
                        value={form.mistakeTrigger}
                        onChange={(event) => setForm({ ...form, mistakeTrigger: event.target.value })}
                        placeholder="Where you got stuck or made the mistake"
                      />
                    </label>
                    <label className="workspace-editor-field">
                      <span className="study-note-label">Why it happened</span>
                      <textarea
                        rows={3}
                        value={form.mistakeReason}
                        onChange={(event) => setForm({ ...form, mistakeReason: event.target.value })}
                        placeholder="Wrong assumption, missed condition, or gap in understanding"
                      />
                    </label>
                    <label className="workspace-editor-field">
                      <span className="study-note-label">Fix / takeaway</span>
                      <textarea
                        rows={3}
                        value={form.mistakeFix}
                        onChange={(event) => setForm({ ...form, mistakeFix: event.target.value })}
                        placeholder="What you will do differently next time"
                      />
                    </label>
                  </div>
                </section>
              </div>

              <div className="problem-workspace-side">
                <ActiveRecallPanel problem={activeProblem} />
              </div>
            </div>
          </section>
        ) : (
          <>
        <section className="filters">
          <input
            className="search-input"
            placeholder="Search problem, note, platform, or tag..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | "all" | "revisit")}>
            <option value="all">All status</option>
            <option value="unsolved">Unsolved</option>
            <option value="solved">Solved</option>
            <option value="revisit">Revisit</option>
          </select>

          <select
            value={difficultyFilter}
            onChange={(event) => setDifficultyFilter(event.target.value as Difficulty | "all")}
          >
            <option value="all">All difficulty</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          <button className="ghost-btn" onClick={() => openAddDrawer(selectedTopic !== "all" ? selectedTopic : undefined)}>
            Quick add
          </button>
        </section>

        <section className="problem-list">
          <div className="section-heading">
            <div>
              <p className="panel-label">Problems</p>
              <h3>{filteredProblems.length} records</h3>
            </div>
            <span className="section-note">{selectedTopicData ? selectedTopicData.name : "All"}</span>
          </div>

          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : filteredProblems.length === 0 ? (
            <div className="empty-state">No problems yet.</div>
          ) : (
            <div className="problem-table-container">
              <table className="dsa-table">
                <thead>
                  <tr>
                    <th style={{ width: "90px" }}>Status</th>
                    <th>Problem</th>
                    <th style={{ width: "120px" }}>Importance</th>
                    <th style={{ width: "100px" }}>Practice</th>
                    <th style={{ width: "80px" }}>Note</th>
                    <th style={{ width: "90px" }}>Revision</th>
                    <th style={{ width: "120px" }}>Difficulty</th>
                    <th style={{ width: "125px" }}>Focus</th>
                    <th style={{ width: "200px" }}>Meaning</th>
                    {editMode ? <th style={{ width: "90px" }}>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {selectedTopic === "all"
                    ? groupedByTopicAndSection.map((group) => (
                        <Fragment key={group.topicId}>
                          <tr
                            className="table-topic-header-row"
                            onClick={() => toggleTopicExpanded(group.topicId)}
                            style={{ cursor: "pointer" }}
                          >
                            <td colSpan={editMode ? 10 : 9} className="table-topic-header-cell">
                              <div className="topic-header-content">
                                <span className="expand-arrow" style={{ color: group.accent }}>
                                  {expandedTopics.has(group.topicId) ? "▼" : "▶"}
                                </span>
                                <span className="topic-name">{group.topicName}</span>
                                <span className="topic-stats-badge">
                                  {group.solvedCount} / {group.totalCount} Solved
                                </span>
                              </div>
                            </td>
                          </tr>

                          {expandedTopics.has(group.topicId)
                            ? group.sections.map((sectionGroup) => (
                                <SectionBlock
                                  key={sectionGroup.sectionKey}
                                  group={sectionGroup}
                                  accent={group.accent}
                                  canEdit={editMode}
                                  revisionStateMap={revisionStateMap}
                                  problemCategoryMap={problemCategoryMap}
                                  nowDate={nowDate}
                                  onOpenStudy={openStudyView}
                                  onToggleStatus={updateStatus}
                                  onOpenEdit={openEditDrawer}
                                  onTogglePin={togglePin}
                                  onOpenLink={openProblemLink}
                                  onDelete={deleteProblem}
                                  rowLimit={sectionRowLimit}
                                  onLoadMore={() => setSectionRowLimit((value) => value + 30)}
                                />
                              ))
                            : null}
                        </Fragment>
                      ))
                    : groupedByTopicAndSection.flatMap((group) =>
                        group.sections.map((sectionGroup) => (
                          <SectionBlock
                            key={sectionGroup.sectionKey}
                            group={sectionGroup}
                            accent={group.accent}
                            canEdit={editMode}
                            revisionStateMap={revisionStateMap}
                            problemCategoryMap={problemCategoryMap}
                            nowDate={nowDate}
                            onOpenStudy={openStudyView}
                            onToggleStatus={updateStatus}
                            onOpenEdit={openEditDrawer}
                            onTogglePin={togglePin}
                            onOpenLink={openProblemLink}
                            onDelete={deleteProblem}
                            rowLimit={sectionRowLimit}
                            onLoadMore={() => setSectionRowLimit((value) => value + 30)}
                          />
                        ))
                      )}
                </tbody>
              </table>
            </div>
          )}
        </section>
          </>
        )}
      </main>

      {drawerOpen ? (
        <div
          className={`drawer-backdrop ${drawerMode === "notes" ? "notes-backdrop" : ""}`}
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className={`drawer ${drawerMode === "notes" ? "notes-drawer" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <p className="panel-label">
                  {activeProblem ? (drawerMode === "edit" ? "Edit" : "Notes") : "Add"}
                </p>
                <h3>{activeProblem ? activeProblem.title : "New"}</h3>
              </div>
              <button className="ghost-btn" onClick={() => setDrawerOpen(false)}>
                Close
              </button>
            </div>

            {drawerMode === "edit" ? (
              <>
                <div className="drawer-body">
                  {activeProblem && activeRevisionState ? (
                    <div className={`revision-summary ${activeRevisionState.isOverdue ? "overdue" : activeRevisionState.isDue ? "due" : ""}`}>
                      <div>
                        <p className="panel-label">Spaced repetition</p>
                        <strong>{activeRevisionState.label || "Scheduled"}</strong>
                        <span>{activeRevisionState.subtitle}</span>
                      </div>
                      {!activeRevisionState.isComplete ? (
                        <button className="revision-inline-action" onClick={() => openProblemLink(activeProblem)}>
                          Open
                        </button>
                      ) : (
                        <span className="revision-complete-pill">Completed</span>
                      )}
                    </div>
                  ) : null}

                  <label>
                    Title
                    <input
                      value={form.title}
                      onChange={(event) => setForm({ ...form, title: event.target.value })}
                      placeholder="e.g. Two Sum"
                    />
                  </label>

                  <label>
                    Topic
                    <select
                      value={form.topicId}
                      onChange={(event) => setForm({ ...form, topicId: event.target.value })}
                    >
                      <option value="">Select topic</option>
                      {topics.map((topic) => (
                        <option key={topic._id} value={topic._id}>
                          {topic.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Section
                    <input
                      value={form.roadmapSection}
                      onChange={(event) => setForm({ ...form, roadmapSection: event.target.value })}
                      placeholder="Basic Arrays"
                    />
                  </label>

                  <div className="two-col">
                    <label>
                      Platform
                      <input
                        value={form.platformName}
                        onChange={(event) => setForm({ ...form, platformName: event.target.value })}
                        placeholder="LeetCode"
                      />
                    </label>

                    <label>
                      Difficulty
                      <select
                        value={form.difficulty}
                        onChange={(event) =>
                          setForm({ ...form, difficulty: event.target.value as Difficulty })
                        }
                      >
                        <option>Easy</option>
                        <option>Medium</option>
                        <option>Hard</option>
                      </select>
                    </label>
                  </div>

                  <div className="two-col">
                    <label>
                      Pattern
                      <input
                        value={form.pattern}
                        onChange={(event) => setForm({ ...form, pattern: event.target.value })}
                        placeholder="Two Pointers"
                      />
                    </label>

                    <label>
                      Invariant
                      <input
                        value={form.invariant}
                        onChange={(event) => setForm({ ...form, invariant: event.target.value })}
                        placeholder="What must always stay true"
                      />
                    </label>
                  </div>

                  <div className="compare-approaches-block">
                    <p className="panel-label">Compare approaches</p>
                    <label>
                      Brute force
                      <textarea
                        rows={3}
                        value={form.compareBruteForce}
                        onChange={(event) =>
                          setForm({ ...form, compareBruteForce: event.target.value })
                        }
                        placeholder="What the naive solution does"
                      />
                    </label>

                    <label>
                      Optimized
                      <textarea
                        rows={3}
                        value={form.compareOptimized}
                        onChange={(event) =>
                          setForm({ ...form, compareOptimized: event.target.value })
                        }
                        placeholder="What you changed to improve it"
                      />
                    </label>

                    <label>
                      Why better
                      <textarea
                        rows={3}
                        value={form.compareWhyBetter}
                        onChange={(event) =>
                          setForm({ ...form, compareWhyBetter: event.target.value })
                        }
                        placeholder="Why the optimized version wins"
                      />
                    </label>
                  </div>

                  <label>
                    Rating
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={form.rating}
                      onChange={(event) =>
                        setForm({ ...form, rating: Number(event.target.value) || 0 })
                      }
                    />
                  </label>

                  <label>
                    Link
                    <input
                      value={form.platformUrl}
                      onChange={(event) => setForm({ ...form, platformUrl: event.target.value })}
                      placeholder="https://..."
                    />
                  </label>

                  <div className="two-col">
                    <label>
                      Status
                      <select
                        value={form.status}
                        onChange={(event) =>
                          setForm({ ...form, status: event.target.value as Status })
                        }
                      >
                        <option value="unsolved">Unsolved</option>
                        <option value="solved">Solved</option>
                        <option value="revisit">Revisit</option>
                        <option value="skipped">Skipped</option>
                      </select>
                    </label>

                    <label>
                      Priority
                      <input
                        type="number"
                        value={form.priority}
                        onChange={(event) =>
                          setForm({ ...form, priority: Number(event.target.value) || 0 })
                        }
                      />
                    </label>
                  </div>

                  <label>
                    Note
                    <input
                      value={form.shortNote}
                      onChange={(event) => setForm({ ...form, shortNote: event.target.value })}
                      placeholder="Short note"
                    />
                  </label>

                  <label>
                    Notes
                    <textarea
                      rows={8}
                      value={form.longNote}
                      onChange={(event) => setForm({ ...form, longNote: event.target.value })}
                      placeholder="What you learned"
                    />
                  </label>

                  <div className="mistake-log-block">
                    <p className="panel-label">Mistake log</p>
                    <label>
                      What went wrong
                      <textarea
                        rows={3}
                        value={form.mistakeTrigger}
                        onChange={(event) => setForm({ ...form, mistakeTrigger: event.target.value })}
                        placeholder="Where the mistake happened"
                      />
                    </label>

                    <label>
                      Why it happened
                      <textarea
                        rows={3}
                        value={form.mistakeReason}
                        onChange={(event) => setForm({ ...form, mistakeReason: event.target.value })}
                        placeholder="Wrong assumption, edge case, or missed detail"
                      />
                    </label>

                    <label>
                      Fix / takeaway
                      <textarea
                        rows={3}
                        value={form.mistakeFix}
                        onChange={(event) => setForm({ ...form, mistakeFix: event.target.value })}
                        placeholder="What you will do next time"
                      />
                    </label>
                  </div>

                  <label>
                    Tags
                    <input
                      value={form.tags}
                      onChange={(event) => setForm({ ...form, tags: event.target.value })}
                      placeholder="dp, revisit"
                    />
                  </label>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.isPinned}
                      onChange={(event) => setForm({ ...form, isPinned: event.target.checked })}
                    />
                    Pin
                  </label>
                </div>

                <div className="drawer-footer">
                  <button className="secondary-btn" onClick={() => setDrawerOpen(false)}>
                    Cancel
                  </button>
                  <button className="primary-btn" disabled={saving} onClick={() => void saveProblem()}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="drawer-body notes-body">
                <div className="notes-head">
                  <button
                    className="link-btn"
                    onClick={() => {
                      if (activeProblem?.platformUrl) {
                          window.open(activeProblem.platformUrl, "_blank", "noopener,noreferrer");
                        }
                    }}
                  >
                    Link
                  </button>
                </div>

                  <div className="pattern-invariant-card">
                    <p className="panel-label">Pattern + invariant</p>
                    <div className="pattern-invariant-grid">
                      <div>
                        <span className="pattern-invariant-label">Pattern</span>
                        <strong>{activeProblem?.pattern?.trim() || form.pattern.trim() || "Not set yet"}</strong>
                      </div>
                      <div>
                        <span className="pattern-invariant-label">Invariant</span>
                        <strong>
                          {activeProblem?.invariant?.trim() || form.invariant.trim() || "Not set yet"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="compare-approaches-card">
                    <p className="panel-label">Compare approaches</p>
                    <div className="compare-approaches-grid">
                      <div>
                        <span className="compare-label">Brute force</span>
                        <strong>{activeProblem?.compareBruteForce?.trim() || form.compareBruteForce.trim() || "Not set yet"}</strong>
                      </div>
                      <div>
                        <span className="compare-label">Optimized</span>
                        <strong>{activeProblem?.compareOptimized?.trim() || form.compareOptimized.trim() || "Not set yet"}</strong>
                      </div>
                      <div>
                        <span className="compare-label">Why better</span>
                        <strong>{activeProblem?.compareWhyBetter?.trim() || form.compareWhyBetter.trim() || "Not set yet"}</strong>
                      </div>
                    </div>
                  </div>

                  <label>
                    Note
                    <input
                      value={form.shortNote}
                      onChange={(event) => setForm({ ...form, shortNote: event.target.value })}
                      placeholder="Short note"
                    />
                  </label>

                  <label>
                    Notes
                    <textarea
                      rows={10}
                      value={form.longNote}
                      onChange={(event) => setForm({ ...form, longNote: event.target.value })}
                      placeholder="What you learned"
                    />
                  </label>

                  <div className="mistake-log-block">
                    <p className="panel-label">Mistake log</p>
                    <label>
                      What went wrong
                      <textarea
                        rows={3}
                        value={form.mistakeTrigger}
                        onChange={(event) => setForm({ ...form, mistakeTrigger: event.target.value })}
                        placeholder="Where the mistake happened"
                      />
                    </label>

                    <label>
                      Why it happened
                      <textarea
                        rows={3}
                        value={form.mistakeReason}
                        onChange={(event) => setForm({ ...form, mistakeReason: event.target.value })}
                        placeholder="Wrong assumption, edge case, or missed detail"
                      />
                    </label>

                    <label>
                      Fix / takeaway
                      <textarea
                        rows={3}
                        value={form.mistakeFix}
                        onChange={(event) => setForm({ ...form, mistakeFix: event.target.value })}
                        placeholder="What you will do next time"
                      />
                    </label>
                  </div>

                  {activeProblem ? (
                    <p className="muted">Saved: {activeProblem.title}</p>
                  ) : null}
                </div>

                <div className="drawer-footer">
                  <button className="secondary-btn" onClick={() => setDrawerOpen(false)}>
                    Close
                  </button>
                  <button className="primary-btn" disabled={saving} onClick={() => void saveProblem()}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );

  return isAuthenticated ? dashboardView : authView;
}

function ActivityInsightsPanel({
  insights,
  scopeLabel,
  onOpenProblem,
  onCompleteRevision,
  onFilterTopic,
}: {
  insights: ActivityInsights;
  scopeLabel: string;
  onOpenProblem: (problemId: string) => void;
  onCompleteRevision: (problemId: string) => void;
  onFilterTopic: (topicId: string) => void;
}) {
  const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const allDays = useMemo(() => insights.weeks.flatMap((week) => week.days), [insights.weeks]);
  const selectedDay =
    allDays.find((day) => day.dateKey === selectedDateKey) ??
    allDays.find((day) => day.isToday && !day.isFuture) ??
    [...allDays].reverse().find((day) => day.total > 0) ??
    allDays[allDays.length - 1] ??
    null;

  useEffect(() => {
    if (!selectedDay) {
      return;
    }

    if (selectedDateKey === null || !allDays.some((day) => day.dateKey === selectedDateKey)) {
      setSelectedDateKey(selectedDay.dateKey);
    }
  }, [allDays, selectedDateKey, selectedDay]);

  const eventLabels: Record<ActivityKind, string> = {
    solved: "Solved",
    revision: "Revision",
    revisit: "Revisit",
  };
  const groupedSelectedItems = useMemo(() => {
    if (!selectedDay) {
      return [];
    }

    const grouped = new Map<
      string,
      {
        problemId: string;
        problemTitle: string;
        topicId: string;
        topicName: string;
        difficulty: Difficulty;
        platformName: string;
        kinds: ActivityKind[];
      }
    >();

    for (const item of selectedDay.items) {
      const existing = grouped.get(item.problemId);
      if (existing) {
        if (!existing.kinds.includes(item.kind)) {
          existing.kinds.push(item.kind);
        }
        continue;
      }

      grouped.set(item.problemId, {
        problemId: item.problemId,
        problemTitle: item.problemTitle,
        topicId: item.topicId,
        topicName: item.topicName,
        difficulty: item.difficulty,
        platformName: item.platformName,
        kinds: [item.kind],
      });
    }

    return [...grouped.values()].sort((left, right) => left.problemTitle.localeCompare(right.problemTitle));
  }, [selectedDay]);
  const needsTodayAction = insights.todayCount === 0;
  const streakGuardMessage =
    insights.currentStreak > 0
      ? needsTodayAction
        ? `You are on a ${insights.currentStreak}-day streak. One focused session today keeps it alive.`
        : `Streak protected for today. ${insights.currentStreak} days and counting.`
      : needsTodayAction
      ? "No active streak yet. Solve or revise one problem today to start one."
      : "Strong start. Today's work has already started your next streak.";

  return (
    <section className="activity-panel">
      <div className="activity-summary">
        <div className="activity-summary-copy">
          <p className="panel-label">Consistency</p>
          <h3>{scopeLabel}</h3>
          <p className="section-note">
            {insights.lastActiveLabel}
          </p>
        </div>

        <div className="activity-metrics-grid">
          <article className="activity-metric-card strong">
            <span>Current streak</span>
            <strong>{insights.currentStreak}</strong>
            <p>{insights.todayCount > 0 ? `${insights.todayCount} today` : "Keep it alive today"}</p>
          </article>
          <article className="activity-metric-card">
            <span>Best streak</span>
            <strong>{insights.bestStreak}</strong>
            <p>{insights.thisWeekCount} this week</p>
          </article>
          <article className="activity-metric-card">
            <span>Active days</span>
            <strong>{insights.activeDays}</strong>
            <p>{insights.totalActivity} total sessions</p>
          </article>
          <article className="activity-metric-card">
            <span>Solved / Revise</span>
            <strong>{insights.solvedActivity}/{insights.revisionActivity}</strong>
            <p>{insights.revisitActivity} revisit marks</p>
          </article>
        </div>

        <article className={`streak-guard-card ${needsTodayAction ? "needs-action" : "safe"}`}>
          <span className="streak-guard-label">Streak guard</span>
          <strong>{needsTodayAction ? "Protect today" : "Covered today"}</strong>
          <p>{streakGuardMessage}</p>
        </article>
      </div>

      <div className="activity-heatmap-shell">
        <div className="activity-heatmap-heading">
          <div>
            <p className="panel-label">Activity heatmap</p>
            <h3>Last {insights.weeks.length} weeks</h3>
          </div>
          <div className="activity-legend">
            <span>Less</span>
            <div className="activity-legend-scale">
              <i className="activity-level-0" />
              <i className="activity-level-1" />
              <i className="activity-level-2" />
              <i className="activity-level-3" />
              <i className="activity-level-4" />
            </div>
            <span>More</span>
          </div>
        </div>

        <div className="activity-heatmap-grid">
          <div className="activity-weekday-rail" aria-hidden="true">
            {weekdayLabels.map((label, index) => (
              <span key={`${label}-${index}`}>{index % 2 === 0 ? label : ""}</span>
            ))}
          </div>

          <div className="activity-weeks">
            {insights.weeks.map((week, weekIndex) => (
              <div key={`${week.label}-${weekIndex}`} className="activity-week-column">
                <span className="activity-month-label">
                  {weekIndex === 0 || insights.weeks[weekIndex - 1]?.days[0].date.getMonth() !== week.days[0].date.getMonth()
                    ? week.label
                    : ""}
                </span>
                {week.days.map((day) => {
                  const title =
                    `${formatActivityDate(day.date)}: ${day.total} item${day.total === 1 ? "" : "s"}` +
                    (day.total > 0
                      ? ` (${day.solved} solved, ${day.revision} revisions, ${day.revisit} revisit)`
                      : "");

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      className={[
                        "activity-cell",
                        `activity-level-${day.level}`,
                        selectedDay?.dateKey === day.dateKey ? "selected" : "",
                        day.isToday ? "today" : "",
                        day.isFuture ? "future" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={title}
                      aria-label={title}
                      onClick={() => setSelectedDateKey(day.dateKey)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {selectedDay ? (
          <div className="activity-detail-panel">
            <div className="activity-detail-head">
              <div>
                <p className="panel-label">Day details</p>
                <h3>{formatActivityDate(selectedDay.date)}</h3>
              </div>
              <span className="activity-detail-count">
                {selectedDay.total} item{selectedDay.total === 1 ? "" : "s"}
              </span>
            </div>

            {selectedDay.total > 0 ? (
              <div className="activity-detail-list">
                {groupedSelectedItems.map((item) => (
                  <article key={`${selectedDay.dateKey}-${item.problemId}`} className="activity-detail-item">
                    <div className="activity-detail-copy">
                      <strong>{item.problemTitle}</strong>
                      <span>
                        {item.topicName} · {item.platformName} · {item.difficulty}
                      </span>
                      <div className="activity-kind-row">
                        {item.kinds.map((kind) => (
                          <span key={`${item.problemId}-${kind}`} className={`activity-kind-pill activity-kind-${kind}`}>
                            {eventLabels[kind]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="activity-detail-actions">
                      <button type="button" className="secondary-btn activity-action-btn" onClick={() => onOpenProblem(item.problemId)}>
                        Open
                      </button>
                      <button type="button" className="secondary-btn activity-action-btn" onClick={() => onFilterTopic(item.topicId)}>
                        Topic
                      </button>
                      {item.kinds.includes("revision") || item.kinds.includes("revisit") || item.kinds.includes("solved") ? (
                        <button
                          type="button"
                          className="primary-btn activity-action-btn"
                          onClick={() => onCompleteRevision(item.problemId)}
                        >
                          Revise done
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="activity-empty-day">No recorded practice on this day.</div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function SectionBadge({
  icon,
  label,
  tone,
}: {
  icon: string;
  label: string;
  tone: "gold" | "mint" | "sky" | "rose" | "amber";
}) {
  return (
    <span className={`section-badge section-badge-${tone}`}>
      <span>{icon}</span>
      {label}
    </span>
  );
}

const ActiveRecallPanel = memo(function ActiveRecallPanel({ problem }: { problem: Problem }) {
  const [showHints, setShowHints] = useState(false);
  const prompts = useMemo(() => buildRecallPrompts(problem), [problem]);

  return (
    <section className="recall-panel">
      <div className="section-heading">
        <div>
          <p className="panel-label">
            <SectionBadge icon="🎯" label="Active recall" tone="mint" />
          </p>
          <h3>Answer before you reveal</h3>
        </div>
        <button className="secondary-btn recall-toggle" onClick={() => setShowHints((value) => !value)}>
          {showHints ? "Hide hints" : "Show hints"}
        </button>
      </div>

      <p className="section-note">
        Quick self-check. Try to answer each prompt from memory, then reveal the hint if you get stuck.
      </p>

      <div className="recall-grid">
        {prompts.map((prompt) => (
          <article key={prompt.question} className="recall-card">
            <strong>{prompt.question}</strong>
            <span>{showHints ? prompt.hint : "Think first, then reveal the hint."}</span>
          </article>
        ))}
      </div>
    </section>
  );
});

const ProblemSummaryPanel = memo(function ProblemSummaryPanel({ problem }: { problem: Problem }) {
  const items = useMemo(() => buildProblemSummary(problem), [problem]);

  return (
    <section className="summary-template-card">
      <div className="section-heading">
        <div>
          <p className="panel-label">
            <SectionBadge icon="✨" label="Study summary" tone="gold" />
          </p>
          <h3>One-page memory sheet</h3>
        </div>
      </div>

      <p className="section-note">
        This is a compact recap of the problem using the fields you already filled in, so review stays fast.
      </p>

      <div className="summary-template-grid">
        {items.map((item) => (
          <article key={item.label} className="summary-template-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
});
