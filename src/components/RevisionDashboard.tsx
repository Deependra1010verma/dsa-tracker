import type { Dispatch, SetStateAction } from "react";
import type { Problem, RevisionState } from "../appTypes";
import { getRevisionQueueMeta } from "../utils/problemUtils";

export type RevisionQueueItem = {
  problem: Problem;
  state: RevisionState;
};

type RevisionDashboardProps = {
  presetName: string;
  presetDesc: string;
  intervalCount: number;
  revisionCount: number;
  dueItems: RevisionQueueItem[];
  upcomingItems: RevisionQueueItem[];
  revisedTodayItems: RevisionQueueItem[];
  allUpcomingItems: RevisionQueueItem[];
  nextRevisionCandidate: Problem | null;
  completingRevisionIds: Set<string>;
  snoozingRevisionIds: Set<string>;
  currentStreak: number;
  dueLaneExpanded: boolean;
  comingUpLaneExpanded: boolean;
  revisedTodayLaneExpanded: boolean;
  setDueLaneExpanded: Dispatch<SetStateAction<boolean>>;
  setComingUpLaneExpanded: Dispatch<SetStateAction<boolean>>;
  setRevisedTodayLaneExpanded: Dispatch<SetStateAction<boolean>>;
  onStartRevision: (problem: Problem) => void;
  onOpenWorkspace: (problem: Problem) => void;
  onCompleteRevision: (problem: Problem) => void;
  onSnoozeRevision: (problem: Problem, days: number) => void;
  onOpenLink: (problem: Problem) => void;
};

function WorkspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="workspace-icon">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
      <path d="M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 1 3-3h7z"></path>
    </svg>
  );
}

function RevisionCard({
  item,
  tone,
  completingRevisionIds,
  snoozingRevisionIds,
  onOpenWorkspace,
  onCompleteRevision,
  onSnoozeRevision,
  onOpenLink,
}: {
  item: RevisionQueueItem;
  tone: "due" | "upcoming";
  completingRevisionIds: Set<string>;
  snoozingRevisionIds?: Set<string>;
  onOpenWorkspace: (problem: Problem) => void;
  onCompleteRevision: (problem: Problem) => void;
  onSnoozeRevision?: (problem: Problem, days: number) => void;
  onOpenLink: (problem: Problem) => void;
}) {
  const { problem, state } = item;
  const isChecked = state.isComplete || completingRevisionIds.has(problem._id);
  const className = tone === "due" ? `revision-card ${state.isOverdue ? "overdue" : "due"}` : "revision-card upcoming";

  return (
    <article className={className}>
      <button
        className={`revision-check ${isChecked ? "checked" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onCompleteRevision(problem);
        }}
        aria-label="Mark revision complete"
        title="Mark done"
        disabled={completingRevisionIds.has(problem._id)}
      >
        {isChecked ? "✓" : ""}
      </button>
      <div className="revision-card-copy">
        <div className="revision-title-row">
          <strong>{problem.title}</strong>
          <button
            type="button"
            className="table-workspace-btn revision-workspace-btn"
            onClick={(event) => {
              event.stopPropagation();
              onOpenWorkspace(problem);
            }}
            title="Open Problem Overview"
          >
            <WorkspaceIcon />
          </button>
        </div>
        <div className="revision-meta-row">
          <span>{state.subtitle}</span>
          <span>{problem.topic.name}</span>
          <span>{problem.difficulty}</span>
        </div>
      </div>
      <div className="revision-card-actions">
        <span className={`revision-priority-pill ${tone === "upcoming" ? "subtle" : ""}`}>
          {getRevisionQueueMeta(problem, state).label}
        </span>
        {tone === "due" && snoozingRevisionIds && onSnoozeRevision ? (
          <button
            className="revision-action ghost snooze-btn"
            title="Snooze 1 day"
            disabled={snoozingRevisionIds.has(problem._id)}
            onClick={(event) => {
              event.stopPropagation();
              onSnoozeRevision(problem, 1);
            }}
          >
            {snoozingRevisionIds.has(problem._id) ? "..." : "⏰ +1d"}
          </button>
        ) : null}
        <button className={`revision-action ${tone === "upcoming" ? "ghost" : ""}`} onClick={() => onOpenLink(problem)}>
          Open
        </button>
      </div>
    </article>
  );
}

function groupUpcomingItems(items: RevisionQueueItem[]) {
  const tomorrow: RevisionQueueItem[] = [];
  const thisWeek: RevisionQueueItem[] = [];
  const later: RevisionQueueItem[] = [];

  for (const item of items) {
    const daysAway = item.state.daysAway ?? 999;
    if (daysAway <= 1) tomorrow.push(item);
    else if (daysAway <= 7) thisWeek.push(item);
    else later.push(item);
  }

  return [
    { label: "Tomorrow", items: tomorrow },
    { label: "This week", items: thisWeek },
    { label: "Later", items: later },
  ].filter((group) => group.items.length > 0);
}

export function RevisionDashboard({
  presetName,
  presetDesc,
  intervalCount,
  revisionCount,
  dueItems,
  upcomingItems,
  revisedTodayItems,
  allUpcomingItems,
  nextRevisionCandidate,
  completingRevisionIds,
  snoozingRevisionIds,
  currentStreak,
  dueLaneExpanded,
  comingUpLaneExpanded,
  revisedTodayLaneExpanded,
  setDueLaneExpanded,
  setComingUpLaneExpanded,
  setRevisedTodayLaneExpanded,
  onStartRevision,
  onOpenWorkspace,
  onCompleteRevision,
  onSnoozeRevision,
  onOpenLink,
}: RevisionDashboardProps) {
  return (
    <section className="revision-panel revision-dashboard">
      <div className="revision-dashboard-head">
        <div>
          <p className="panel-label">Spaced repetition ({presetName})</p>
          <h3>Revision queue</h3>
          <p className="section-note">{revisionCount} unique items scheduled · Pace: {presetDesc}</p>
        </div>
        <div className="revision-head-actions">
          <button
            className="revision-action"
            disabled={!nextRevisionCandidate}
            onClick={() => {
              if (nextRevisionCandidate) onStartRevision(nextRevisionCandidate);
            }}
          >
            Start next
          </button>
        </div>
      </div>

      <div className="revision-metrics">
        <div className="revision-metric-card urgent">
          <span>Due</span>
          <strong>{dueItems.length}</strong>
        </div>
        <div className="revision-metric-card">
          <span>Coming up</span>
          <strong>{upcomingItems.length}</strong>
        </div>
        <div className="revision-metric-card done">
          <span>Revised today</span>
          <strong>{revisedTodayItems.length}</strong>
        </div>
      </div>

      <div className="revision-board">
        <div className="revision-lane due-lane">
          <div className="revision-lane-head">
            <span className="revision-lane-kicker">Now</span>
            <strong>Due to revise ({dueItems.length})</strong>
          </div>
          <div className="revision-list">
            {dueItems.length > 0 ? (
              (dueLaneExpanded ? dueItems : dueItems.slice(0, 5)).map((item) => (
                <RevisionCard
                  key={item.problem._id}
                  item={item}
                  tone="due"
                  completingRevisionIds={completingRevisionIds}
                  snoozingRevisionIds={snoozingRevisionIds}
                  onOpenWorkspace={onOpenWorkspace}
                  onCompleteRevision={onCompleteRevision}
                  onSnoozeRevision={onSnoozeRevision}
                  onOpenLink={onOpenLink}
                />
              ))
            ) : revisedTodayItems.length > 0 ? (
              <div className="revision-empty revision-all-done">
                <span className="revision-done-icon">🎉</span>
                <strong>All caught up for today!</strong>
                <span>
                  {allUpcomingItems[0]
                    ? `Next: ${allUpcomingItems[0].state.subtitle} · ${allUpcomingItems[0].problem.title}`
                    : "No more revisions scheduled"}
                </span>
                {currentStreak > 0 ? <span className="revision-done-streak">🔥 {currentStreak} day streak</span> : null}
              </div>
            ) : (
              <div className="revision-empty">No revision is due right now.</div>
            )}

            {dueItems.length > 5 ? (
              <button type="button" className="lane-show-more-btn" onClick={() => setDueLaneExpanded(!dueLaneExpanded)}>
                {dueLaneExpanded ? "Show Less" : `Show ${dueItems.length - 5} more...`}
              </button>
            ) : null}
          </div>
        </div>

        <div className="revision-lane">
          <div className="revision-lane-head">
            <span className="revision-lane-kicker">Later</span>
            <strong>Coming up ({upcomingItems.length})</strong>
          </div>
          <div className="revision-list">
            {upcomingItems.length > 0 ? (
              groupUpcomingItems(upcomingItems).map((group) => (
                <div key={group.label} className="coming-up-group">
                  <div className="coming-up-group-label">
                    <span>{group.label}</span>
                    <span className="coming-up-group-count">{group.items.length}</span>
                  </div>
                  {(comingUpLaneExpanded ? group.items : group.items.slice(0, 3)).map((item) => (
                    <RevisionCard
                      key={item.problem._id}
                      item={item}
                      tone="upcoming"
                      completingRevisionIds={completingRevisionIds}
                      onOpenWorkspace={onOpenWorkspace}
                      onCompleteRevision={onCompleteRevision}
                      onOpenLink={onOpenLink}
                    />
                  ))}
                  {!comingUpLaneExpanded && group.items.length > 3 ? (
                    <div className="coming-up-overflow">
                      +{group.items.length - 3} more in {group.label.toLowerCase()}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="revision-empty">No upcoming revisions scheduled.</div>
            )}

            {upcomingItems.length > 0 ? (
              <button type="button" className="lane-show-more-btn" onClick={() => setComingUpLaneExpanded(!comingUpLaneExpanded)}>
                {comingUpLaneExpanded ? "Show less" : `Show all ${upcomingItems.length} coming up`}
              </button>
            ) : null}
          </div>
        </div>

        <div className="revision-lane revised-lane">
          <div className="revision-lane-head">
            <span className="revision-lane-kicker">Session</span>
            <strong>Revised today ({revisedTodayItems.length})</strong>
          </div>
          <div className="revision-list">
            {revisedTodayItems.length > 0 ? (
              (revisedTodayLaneExpanded ? revisedTodayItems : revisedTodayItems.slice(0, 5)).map(({ problem }) => (
                <article key={problem._id} className="revision-card revised">
                  <button className="revision-check checked" disabled aria-label="Revision completed">
                    ✓
                  </button>
                  <div className="revision-card-copy">
                    <div className="revision-title-row">
                      <strong>{problem.title}</strong>
                      <button
                        type="button"
                        className="table-workspace-btn revision-workspace-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenWorkspace(problem);
                        }}
                        title="Open Problem Overview"
                      >
                        <WorkspaceIcon />
                      </button>
                    </div>
                    <div className="revision-meta-row">
                      <span>Rev {problem.revisionCount} · Stage {problem.revisionStage ?? 0}/{intervalCount}</span>
                      <span>{problem.topic.name}</span>
                    </div>
                  </div>
                  <div className="revision-card-actions">
                    <span className="revision-priority-pill complete">Revised</span>
                    <button className="revision-action ghost" onClick={() => onOpenLink(problem)}>
                      Open
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="revision-empty">Today's completed revisions will appear here.</div>
            )}

            {revisedTodayItems.length > 5 ? (
              <button type="button" className="lane-show-more-btn" onClick={() => setRevisedTodayLaneExpanded(!revisedTodayLaneExpanded)}>
                {revisedTodayLaneExpanded ? "Show Less" : `Show ${revisedTodayItems.length - 5} more...`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
