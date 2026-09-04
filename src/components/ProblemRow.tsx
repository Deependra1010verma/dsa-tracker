import { memo } from "react";
import type { Problem, RevisionState, Status } from "../appTypes";
import { formatRating, hasNoteContent } from "../utils/problemUtils";

export type ProblemRowProps = {
  problem: Problem;
  displayIndex: number;
  canEdit: boolean;
  revisionState: RevisionState;
  categories: string[];
  justSolved?: boolean;
  isFocused?: boolean;
  onOpenStudy: (problem: Problem) => void;
  onToggleStatus: (problem: Problem, nextStatus: Status) => void;
  onOpenEdit: (problem: Problem) => void;
  onTogglePin: (problem: Problem) => void;
  onOpenLink: (problem: Problem) => void;
  onDelete: (problemId: string) => void;
};

export const ProblemRow = memo(function ProblemRow({
  problem,
  displayIndex,
  canEdit,
  categories,
  justSolved,
  isFocused,
  onOpenStudy,
  onToggleStatus,
  onOpenEdit,
  onTogglePin,
  onOpenLink,
  onDelete,
}: ProblemRowProps) {
  const hasNote = hasNoteContent(problem);

  function nextStatusCycle(current: Status): Status {
    if (current === "unsolved") return "shaky";
    if (current === "shaky") return "solved";
    if (current === "solved") return "unsolved";
    return "solved";
  }

  return (
    <tr
      className={`table-problem-row${justSolved ? " row-just-solved" : ""}${isFocused ? " row-kb-focused" : ""}`}
      data-pid={problem._id}
    >
      <td className="status-col">
        <div className="status-cell-content">
          <span className="row-index-num">{displayIndex}</span>
          <button
            type="button"
            className={`status-checkbox${problem.status === "solved" ? " checked" : problem.status === "shaky" ? " shaky" : ""}`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleStatus(problem, nextStatusCycle(problem.status));
            }}
            aria-label="Toggle status"
            title={
              problem.status === "unsolved"
                ? "Mark shaky"
                : problem.status === "shaky" || problem.status === "revisit" || problem.status === "skipped"
                ? "Mark solved"
                : "Mark unsolved"
            }
          >
            {problem.status === "solved" ? <span className="checkbox-inner-dot" /> : problem.status === "shaky" ? <span className="checkbox-shaky-dot">~</span> : null}
          </button>
        </div>
      </td>
      <td className="problem-title-col">
        <div className="problem-title-wrapper">
          <a
            href={problem.platformUrl}
            target="_blank"
            rel="noreferrer"
            className="problem-title-text"
            onClick={(event) => event.stopPropagation()}
            title={`Open ${problem.title} on ${problem.platformName}`}
          >
            {problem.title}
          </a>
          {problem.pattern ? <span className="pattern-chip">{problem.pattern}</span> : null}
        </div>
      </td>
      <td className="importance-col">
        {problem.rating ? <span className="importance-rating-badge">{formatRating(problem.rating)}</span> : <span className="importance-rating-empty">-</span>}
      </td>
      <td className="practice-col">
        <button
          type="button"
          className="table-workspace-btn"
          onClick={(event) => {
            event.stopPropagation();
            onOpenStudy(problem);
          }}
          title="Open Problem Workspace"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="workspace-icon">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
        </button>
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
