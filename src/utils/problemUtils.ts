import type { Problem, RecallPrompt, RevisionQueueMeta, RevisionState } from "../appTypes";
import { deriveRevisionState } from "../revision";

export function formatRating(rating?: number) {
  return typeof rating === "number" && rating > 0 ? `${rating}/10` : "";
}

export function composeMistakeLog(trigger: string, reason: string, fix: string) {
  return [trigger, reason, fix].filter((part) => part.length > 0).join("\n\n");
}

export function splitMistakeLog(value?: string | null) {
  const parts = (value ?? "")
    .split(/\n\s*\n/)
    .filter((part) => part.length > 0);

  return {
    trigger: parts[0] ?? "",
    reason: parts[1] ?? "",
    fix: parts[2] ?? "",
  };
}

export function buildRecallPrompts(problem: Problem): RecallPrompt[] {
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
      question: "Which pattern fits here?",
      hint: patternHint,
    },
    {
      question: "What rule should not break?",
      hint: invariantHint,
    },
    {
      question: "Why is your better idea faster?",
      hint: compareHint,
    },
    {
      question: "What keeps changing while solving?",
      hint: tagSummary,
    },
    {
      question: "What mistake should you avoid?",
      hint: mistakeHint,
    },
    {
      question: "Explain the idea in one simple line.",
      hint: problem.shortNote || "keep it short and focus on the core transition",
    },
  ];
}

export function formatRevisionDueText(daysAway: number | null, isDue: boolean, isComplete: boolean) {
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

export function getRevisionState(problem: Problem, now: Date, intervals?: number[]): RevisionState {
  const derived = deriveRevisionState(problem, now, intervals);
  const nextStep = derived.currentIntervalDays;

  return {
    stage: derived.stage,
    label: derived.isComplete ? "Revision complete" : nextStep === null ? "Scheduled" : nextStep === 1 ? "1 day" : `${nextStep} days`,
    subtitle: formatRevisionDueText(derived.daysAway, derived.isDue, derived.isComplete),
    dueDate: derived.dueDate,
    isDue: derived.isDue,
    isOverdue: derived.isOverdue,
    isComplete: derived.isComplete,
    isScheduled: derived.isScheduled,
    daysAway: derived.daysAway,
  };
}

export function getRevisionQueueMeta(problem: Problem, state: RevisionState): RevisionQueueMeta {
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

export function getProblemCategories(problem: Problem): string[] {
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

export function hasNoteContent(problem: Problem | null | undefined): boolean {
  if (!problem) return false;
  if (typeof problem.hasNotes === "boolean") return problem.hasNotes;
  const { trigger, reason, fix } = splitMistakeLog(problem.mistakeLog);
  const resolvedTrigger = problem.mistakeTrigger ?? trigger;
  const resolvedReason = problem.mistakeReason ?? reason;
  const resolvedFix = problem.mistakeFix ?? fix;

  return Boolean(
    (problem.shortNote && problem.shortNote.trim().length > 0) ||
    (problem.longNote && problem.longNote.trim().length > 0) ||
    (problem.codeSnippet && problem.codeSnippet.trim().length > 0) ||
    (problem.mistakeLog && problem.mistakeLog.trim().length > 0) ||
    (resolvedTrigger && resolvedTrigger.trim().length > 0) ||
    (resolvedReason && resolvedReason.trim().length > 0) ||
    (resolvedFix && resolvedFix.trim().length > 0) ||
    (problem.compareBruteForce && problem.compareBruteForce.trim().length > 0) ||
    (problem.compareOptimized && problem.compareOptimized.trim().length > 0) ||
    (problem.compareWhyBetter && problem.compareWhyBetter.trim().length > 0)
  );
}
