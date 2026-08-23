import type {
  ActivityRecord,
  LocalProgressMap,
  PersistedViewState,
  Problem,
  SavedProblemProgress,
  Status,
} from "../appTypes";
import { clearRevisionSchedule, initializeRevisionSchedule, toValidDate } from "../revision";
import { toDateKey } from "./activityUtils";
import { getRevisionState } from "./problemUtils";

export const AUTH_STORAGE_KEY = "dsa-tracker-authenticated";
export const APP_VIEW_STATE_KEY = "dsa-tracker-view-state";
export const LOCAL_PROGRESS_STORAGE_KEY = "dsa-tracker-local-user-progress";
export const LOCAL_ACTIVITY_STORAGE_PREFIX = "dsa-tracker-activity-history";

export function readPersistedViewState(): PersistedViewState {
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

export function readLocalProgress(): LocalProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_PROGRESS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalProgressMap) : {};
  } catch {
    return {};
  }
}

export function saveLocalProgressItem(key: string, updates: Partial<SavedProblemProgress>) {
  if (typeof window === "undefined" || !key) return;
  try {
    const current = readLocalProgress();
    const existing = current[key] ?? { updatedAt: Date.now() };
    current[key] = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(LOCAL_PROGRESS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage error
  }
}

export function saveLocalProgressForProblem(problem: Problem, updates: Partial<SavedProblemProgress>) {
  if (typeof window === "undefined") return;
  try {
    const current = readLocalProgress();
    const updatedAt = Date.now();
    for (const key of new Set([problem.title, problem._id])) {
      if (!key) continue;
      const existing = current[key] ?? { updatedAt };
      current[key] = {
        ...existing,
        ...updates,
        updatedAt,
      };
    }
    window.localStorage.setItem(LOCAL_PROGRESS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage error
  }
}

export function getSavedProgressForProblem(problem: Problem, progress = readLocalProgress()) {
  return progress[problem._id] ?? progress[problem.title] ?? null;
}

export function applySavedProgress(problem: Problem, saved: SavedProblemProgress | null): Problem {
  if (!saved) {
    return problem;
  }

  return {
    ...problem,
    status: saved.status ?? problem.status,
    isPinned: typeof saved.isPinned === "boolean" ? saved.isPinned : problem.isPinned,
    solvedAt: saved.solvedAt ?? problem.solvedAt,
    revisitAt: saved.revisitAt ?? problem.revisitAt,
    lastRevisionAt: saved.lastRevisionAt ?? problem.lastRevisionAt,
    nextRevisionAt:
      Object.prototype.hasOwnProperty.call(saved, "nextRevisionAt") ? saved.nextRevisionAt ?? undefined : problem.nextRevisionAt,
    revisionCompletedAt:
      Object.prototype.hasOwnProperty.call(saved, "revisionCompletedAt")
        ? saved.revisionCompletedAt ?? undefined
        : problem.revisionCompletedAt,
    revisionCount: typeof saved.revisionCount === "number" ? saved.revisionCount : problem.revisionCount,
    revisionStage: typeof saved.revisionStage === "number" ? saved.revisionStage : problem.revisionStage,
  };
}

export function getProblemProgressSnapshot(problem: Problem): Partial<SavedProblemProgress> {
  return {
    status: problem.status,
    isPinned: problem.isPinned,
    solvedAt: problem.solvedAt,
    revisitAt: problem.revisitAt,
    lastRevisionAt: problem.lastRevisionAt,
    nextRevisionAt: problem.nextRevisionAt ?? null,
    revisionCompletedAt: problem.revisionCompletedAt ?? null,
    revisionCount: problem.revisionCount,
    revisionStage: problem.revisionStage,
  };
}

export function toIsoStringOrUndefined(value: unknown) {
  return toValidDate(value)?.toISOString();
}

export function normalizeProblemRevisionDates(problem: Problem): Problem {
  return {
    ...problem,
    solvedAt: toIsoStringOrUndefined(problem.solvedAt),
    revisitAt: toIsoStringOrUndefined(problem.revisitAt),
    lastRevisionAt: toIsoStringOrUndefined(problem.lastRevisionAt),
    nextRevisionAt: toIsoStringOrUndefined(problem.nextRevisionAt),
    revisionCompletedAt: toIsoStringOrUndefined(problem.revisionCompletedAt),
  };
}

export function withStatusSchedule(problem: Problem, nextStatus: Status, nowDate: Date, intervals: number[]): Problem {
  const nextProblem = normalizeProblemRevisionDates({
    ...problem,
    status: nextStatus,
    updatedAt: nowDate.toISOString(),
  });
  const previousStatus = problem.status;

  if (nextStatus === "solved" && previousStatus !== "solved") {
    nextProblem.solvedAt = nowDate.toISOString();
  }

  if (nextStatus === "revisit" && previousStatus !== "revisit") {
    nextProblem.revisitAt = nowDate.toISOString();
  }

  if ((nextStatus === "solved" || nextStatus === "revisit") && previousStatus !== nextStatus) {
    initializeRevisionSchedule(nextProblem, nowDate, intervals);
  } else if (nextStatus === "unsolved" || nextStatus === "skipped") {
    clearRevisionSchedule(nextProblem);
  }

  return normalizeProblemRevisionDates(nextProblem);
}

export function removeLocalProgressItem(key: string) {
  if (typeof window === "undefined" || !key) return;
  try {
    const current = readLocalProgress();
    delete current[key];
    window.localStorage.setItem(LOCAL_PROGRESS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage error
  }
}

export function deduplicateProblems(list: Problem[]): Problem[] {
  const seen = new Set<string>();
  const result: Problem[] = [];
  for (const item of list) {
    if (item && item._id && !seen.has(item._id)) {
      seen.add(item._id);
      result.push(item);
    }
  }
  return result;
}

export function activityStorageKey(problemSet: string) {
  return `${LOCAL_ACTIVITY_STORAGE_PREFIX}:${problemSet || "set1"}`;
}

export function getActivityDedupeKey(activity: ActivityRecord) {
  const date = toValidDate(activity.occurredAt);
  return [
    activity.problem?._id ?? "",
    activity.kind,
    activity.topic?._id ?? "",
    date ? Math.floor(date.getTime() / 1000) : activity.occurredAt,
  ].join(":");
}

export function mergeActivityRecords(...activityGroups: ActivityRecord[][]) {
  const map = new Map<string, ActivityRecord>();
  for (const activity of activityGroups.flat()) {
    if (!activity?.problem?._id || !activity?.topic?._id || !toValidDate(activity.occurredAt)) {
      continue;
    }
    map.set(getActivityDedupeKey(activity), activity);
  }

  return [...map.values()].sort((left, right) => {
    const leftTime = toValidDate(left.occurredAt)?.getTime() ?? 0;
    const rightTime = toValidDate(right.occurredAt)?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

export function isRevisionActionable(problem: Problem, now: Date) {
  const state = getRevisionState(problem, now);
  if (!state.isScheduled || state.isComplete) {
    return false;
  }

  const lastRevisionAt = toValidDate(problem.lastRevisionAt);
  const lastRevisionDay = lastRevisionAt ? toDateKey(lastRevisionAt) : null;
  const todayKey = toDateKey(now);

  if ((problem.revisionCount ?? 0) > 0 && lastRevisionDay === todayKey) {
    return false;
  }

  return true;
}

export function readLocalActivities(problemSet: string): ActivityRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(activityStorageKey(problemSet));
    return raw ? (JSON.parse(raw) as ActivityRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalActivities(problemSet: string, activities: ActivityRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(activityStorageKey(problemSet), JSON.stringify(activities.slice(0, 5000)));
  } catch {
    // ignore storage error
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s timeout

  try {
    const response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
      signal: init?.signal ?? controller.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message || "Request failed");
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
