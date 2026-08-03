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

export function toValidDate(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as never);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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
