import type { ActivityDayBucket, ActivityEntry, ActivityInsights, ActivityRecord, ActivityWeek } from "../appTypes";
import { addDays, startOfDay, toValidDate } from "../revision";

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return new Date();
  }
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function getWeekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

export function daysBetween(now: Date, target: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / msPerDay);
}

export function formatActivityDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatActivityLevel(total: number, solved: number, revision: number, revisit: number): 0 | 1 | 2 | 3 | 4 {
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

export function createEmptyInsights(weeksToShow: number, nowDate: Date): ActivityInsights {
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

export function buildActivityInsights(activities: ActivityRecord[], nowDate: Date, weeksToShow = 16): ActivityInsights {
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
