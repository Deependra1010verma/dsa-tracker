const REVISION_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60] as const;

export const revisionIntervalsDays = [...REVISION_INTERVALS_DAYS] as number[];

export type RevisionScheduleShape = {
  status?: string | null;
  solvedAt?: unknown;
  revisitAt?: unknown;
  lastRevisionAt?: unknown;
  nextRevisionAt?: unknown;
  revisionCompletedAt?: unknown;
  updatedAt?: unknown;
  revisionStage?: number | null;
  revisionCount?: number | null;
};

export type DerivedRevisionState = {
  stage: number;
  dueDate: Date | null;
  isDue: boolean;
  isOverdue: boolean;
  isComplete: boolean;
  isScheduled: boolean;
  daysAway: number | null;
  currentIntervalDays: number | null;
};

export function toValidDate(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as never);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function daysBetween(now: Date, target: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / msPerDay);
}

export function baseRevisionAnchor(problem: RevisionScheduleShape) {
  return (
    toValidDate(problem.lastRevisionAt) ??
    toValidDate(problem.revisitAt) ??
    toValidDate(problem.solvedAt) ??
    toValidDate(problem.updatedAt) ??
    new Date()
  );
}

export function initializeRevisionSchedule(problem: RevisionScheduleShape, anchorOverride?: Date) {
  const anchor = anchorOverride ?? baseRevisionAnchor(problem);
  problem.revisionStage = 0;
  problem.revisionCount = 0;
  problem.lastRevisionAt = anchor;
  problem.nextRevisionAt = addDays(anchor, revisionIntervalsDays[0] ?? 1);
  problem.revisionCompletedAt = undefined;
}

export function advanceRevisionSchedule(problem: RevisionScheduleShape, completedAt = new Date()) {
  const currentStage = Math.max(problem.revisionStage ?? 0, 0);
  const nextStage = currentStage + 1;

  problem.revisionCount = Math.max(problem.revisionCount ?? 0, 0) + 1;
  problem.lastRevisionAt = completedAt;

  if (nextStage >= revisionIntervalsDays.length) {
    problem.revisionStage = revisionIntervalsDays.length;
    problem.nextRevisionAt = undefined;
    problem.revisionCompletedAt = completedAt;
    return;
  }

  problem.revisionStage = nextStage;
  problem.nextRevisionAt = addDays(completedAt, revisionIntervalsDays[nextStage] ?? 1);
  problem.revisionCompletedAt = undefined;
}

export function clearRevisionSchedule(problem: RevisionScheduleShape) {
  problem.revisionStage = 0;
  problem.revisionCount = 0;
  problem.lastRevisionAt = undefined;
  problem.nextRevisionAt = undefined;
  problem.revisionCompletedAt = undefined;
}

export function deriveRevisionState(problem: RevisionScheduleShape, now = new Date()): DerivedRevisionState {
  const solvedAt = toValidDate(problem.solvedAt);
  const revisitAt = toValidDate(problem.revisitAt);
  const lastRevisionAt = toValidDate(problem.lastRevisionAt);
  const nextRevisionAt = toValidDate(problem.nextRevisionAt);
  const completedAt = toValidDate(problem.revisionCompletedAt);
  const anchor = lastRevisionAt ?? revisitAt ?? solvedAt ?? toValidDate(problem.updatedAt) ?? now;
  const stageFromCount =
    (problem.revisionCount ?? 0) > 0 ? Math.min((problem.revisionCount ?? 0) - 1, revisionIntervalsDays.length) : 0;
  const stage = Math.max(problem.revisionStage ?? stageFromCount, 0);
  const isComplete = Boolean(completedAt || (stage >= revisionIntervalsDays.length && !nextRevisionAt));
  const isScheduled = problem.status === "solved" || problem.status === "revisit";

  if (!isScheduled) {
    return {
      stage,
      dueDate: null,
      isDue: false,
      isOverdue: false,
      isComplete,
      isScheduled: false,
      daysAway: null,
      currentIntervalDays: null,
    };
  }

  const fallbackDueDate = nextRevisionAt ?? addDays(anchor, revisionIntervalsDays[Math.min(stage, revisionIntervalsDays.length - 1)] ?? 1);
  const dueDate = isComplete ? null : fallbackDueDate;
  const daysAway = dueDate ? daysBetween(now, dueDate) : null;
  const dueDaysAway = daysAway ?? Number.POSITIVE_INFINITY;

  return {
    stage,
    dueDate,
    isDue: dueDate ? dueDaysAway <= 0 : false,
    isOverdue: dueDate ? dueDaysAway < 0 : false,
    isComplete,
    isScheduled: true,
    daysAway,
    currentIntervalDays: isComplete ? null : revisionIntervalsDays[Math.min(stage, revisionIntervalsDays.length - 1)] ?? null,
  };
}
