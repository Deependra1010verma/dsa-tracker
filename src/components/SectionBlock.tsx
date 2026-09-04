import { Fragment, memo } from "react";
import type { Problem, RevisionState, Status } from "../appTypes";
import { getProblemCategories, getRevisionState } from "../utils/problemUtils";
import { ProblemRow } from "./ProblemRow";

export type SectionBlockProps = {
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
  justSolvedIds: Set<string>;
  kbFocusedId: string | null;
  onOpenStudy: (problem: Problem) => void;
  onToggleStatus: (problem: Problem, nextStatus: Status) => void;
  onOpenEdit: (problem: Problem) => void;
  onTogglePin: (problem: Problem) => void;
  onOpenLink: (problem: Problem) => void;
  onDelete: (problemId: string) => void;
  rowLimit: number;
  onLoadMore: () => void;
  isRevisitView: boolean;
};

export const SectionBlock = memo(function SectionBlock({
  group,
  accent,
  canEdit,
  revisionStateMap,
  problemCategoryMap,
  nowDate,
  justSolvedIds,
  kbFocusedId,
  onOpenStudy,
  onToggleStatus,
  onOpenEdit,
  onTogglePin,
  onOpenLink,
  onDelete,
  rowLimit,
  onLoadMore,
  isRevisitView,
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
              {isRevisitView ? `${group.totalCount} Revision items` : `${group.solvedCount} / ${group.totalCount} Solved`}
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
          justSolved={justSolvedIds.has(problem._id)}
          isFocused={kbFocusedId === problem._id}
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
