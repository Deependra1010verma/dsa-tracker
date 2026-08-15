import { useEffect, useMemo, useState } from "react";
import type { ActivityInsights, ActivityKind, Difficulty, Problem } from "../appTypes";
import { formatActivityDate } from "../utils/activityUtils";
import { isRevisionActionable } from "../utils/storageUtils";

export function ActivityInsightsPanel({
  insights,
  scopeLabel,
  problemLookup,
  nowDate,
  onOpenProblem,
  onCompleteRevision,
  onFilterTopic,
}: {
  insights: ActivityInsights;
  scopeLabel: string;
  problemLookup: Map<string, Problem>;
  nowDate: Date;
  onOpenProblem: (problemId: string) => void;
  onCompleteRevision: (problemId: string) => void;
  onFilterTopic: (topicId: string) => void;
}) {
  const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [expandedActivityDateKey, setExpandedActivityDateKey] = useState<string | null>(null);
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
      const titleKey = item.problemTitle.trim().toLowerCase();
      const existing = grouped.get(titleKey);
      if (existing) {
        if (!existing.kinds.includes(item.kind)) {
          existing.kinds.push(item.kind);
        }
        continue;
      }

      grouped.set(titleKey, {
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
  const visibleSelectedItems =
    expandedActivityDateKey === selectedDay?.dateKey ? groupedSelectedItems : groupedSelectedItems.slice(0, 5);
  const hiddenSelectedItemCount = Math.max(groupedSelectedItems.length - visibleSelectedItems.length, 0);
  const needsTodayAction = insights.todayCount === 0;
  const actionableProblemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of groupedSelectedItems) {
      const problem = problemLookup.get(item.problemId);
      if (problem && isRevisionActionable(problem, nowDate)) {
        ids.add(item.problemId);
      }
    }
    return ids;
  }, [groupedSelectedItems, nowDate, problemLookup]);
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
                {visibleSelectedItems.map((item) => (
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
                          disabled={!actionableProblemIds.has(item.problemId)}
                          onClick={() => onCompleteRevision(item.problemId)}
                        >
                          {actionableProblemIds.has(item.problemId) ? "Revise done" : "Already updated"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
                {groupedSelectedItems.length > 5 ? (
                  <button
                    type="button"
                    className="activity-show-more-btn"
                    onClick={() =>
                      setExpandedActivityDateKey((current) =>
                        current === selectedDay.dateKey ? null : selectedDay.dateKey
                      )
                    }
                  >
                    {hiddenSelectedItemCount > 0 ? `Show ${hiddenSelectedItemCount} more` : "Show less"}
                  </button>
                ) : null}
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
