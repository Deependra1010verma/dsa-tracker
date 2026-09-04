import { Fragment, type Dispatch, type SetStateAction } from "react";
import type { Difficulty, Problem, RatingFilterOption, RevisionState, SortByOption, Status } from "../appTypes";
import { SectionBlock } from "./SectionBlock";

type SectionGroup = {
  sectionKey: string;
  sectionName: string;
  solvedCount: number;
  totalCount: number;
  problems: Array<{ problem: Problem; displayIndex: number }>;
};

export type ProblemTopicGroup = {
  topicId: string;
  topicName: string;
  accent: string;
  solvedCount: number;
  totalCount: number;
  sections: SectionGroup[];
};

type ProblemListViewProps = {
  search: string;
  sortByFilter: SortByOption;
  difficultyFilter: Difficulty | "all";
  ratingFilter: RatingFilterOption;
  selectedTopic: string;
  selectedTopicName: string | null;
  statusFilter: Status | "all" | "revisit";
  filteredProblemCount: number;
  groupedByTopicAndSection: ProblemTopicGroup[];
  loading: boolean;
  editMode: boolean;
  expandedTopics: Set<string>;
  deferredSearch: string;
  revisionStateMap: Map<string, RevisionState>;
  problemCategoryMap: Map<string, string[]>;
  nowDate: Date;
  justSolvedIds: Set<string>;
  kbFocusedId: string | null;
  sectionRowLimit: number;
  setSearch: Dispatch<SetStateAction<string>>;
  setSortByFilter: Dispatch<SetStateAction<SortByOption>>;
  setDifficultyFilter: Dispatch<SetStateAction<Difficulty | "all">>;
  setRatingFilter: Dispatch<SetStateAction<RatingFilterOption>>;
  setSectionRowLimit: Dispatch<SetStateAction<number>>;
  onQuickAdd: () => void;
  onToggleTopicExpanded: (topicId: string) => void;
  onOpenStudy: (problem: Problem) => void;
  onToggleStatus: (problem: Problem, nextStatus: Status) => void;
  onOpenEdit: (problem: Problem) => void;
  onTogglePin: (problem: Problem) => void;
  onOpenLink: (problem: Problem) => void;
  onDelete: (problemId: string) => void;
};

export function ProblemListView({
  search,
  sortByFilter,
  difficultyFilter,
  ratingFilter,
  selectedTopic,
  selectedTopicName,
  statusFilter,
  filteredProblemCount,
  groupedByTopicAndSection,
  loading,
  editMode,
  expandedTopics,
  deferredSearch,
  revisionStateMap,
  problemCategoryMap,
  nowDate,
  justSolvedIds,
  kbFocusedId,
  sectionRowLimit,
  setSearch,
  setSortByFilter,
  setDifficultyFilter,
  setRatingFilter,
  setSectionRowLimit,
  onQuickAdd,
  onToggleTopicExpanded,
  onOpenStudy,
  onToggleStatus,
  onOpenEdit,
  onTogglePin,
  onOpenLink,
  onDelete,
}: ProblemListViewProps) {
  const isGroupedView = selectedTopic === "all" || selectedTopic === "revision";

  return (
    <>
      <section className="filters">
        <input
          className="search-input"
          placeholder="Search problem, note, platform, or tag..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select value={sortByFilter} onChange={(event) => setSortByFilter(event.target.value as SortByOption)} title="Sort solving order">
          <option value="optimal">🎯 Optimal Order (Best Sequence)</option>
          <option value="status">📌 Unsolved First</option>
          <option value="difficulty">⚡ Difficulty (Easy → Hard)</option>
          <option value="rating">⭐ Highest Importance</option>
          <option value="title">🔤 Title (A-Z)</option>
        </select>

        <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value as Difficulty | "all")}>
          <option value="all">All difficulty</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>

        <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value as RatingFilterOption)} title="Filter problems by rating">
          <option value="all">All ratings ⭐</option>
          <option value="10">10 ⭐ (Top Priority)</option>
          <option value="8-9">8-9 ⭐ (High Priority)</option>
          <option value="5-7">5-7 ⭐ (Medium)</option>
        </select>

        <button className="ghost-btn" onClick={onQuickAdd}>
          Quick add
        </button>
      </section>

      <section className="problem-list">
        <div className="section-heading">
          <div>
            <p className="panel-label">Problems</p>
            <h3>{filteredProblemCount} records</h3>
          </div>
          <span className="section-note">{selectedTopicName ?? (selectedTopic === "revision" ? "Revision Queue" : "All")}</span>
        </div>

        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : filteredProblemCount === 0 ? (
          <div className="empty-state">No problems yet.</div>
        ) : (
          <div className="problem-table-container">
            <table className="dsa-table">
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>Status</th>
                  <th>Problem</th>
                  <th style={{ width: "120px" }}>Importance</th>
                  <th style={{ width: "100px" }}>Workspace</th>
                  <th style={{ width: "80px" }}>Note</th>
                  <th style={{ width: "90px" }}>Revision</th>
                  <th style={{ width: "120px" }}>Difficulty</th>
                  <th style={{ width: "125px" }}>Focus</th>
                  <th style={{ width: "200px" }}>Meaning</th>
                  {editMode ? <th style={{ width: "90px" }}>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {isGroupedView
                  ? groupedByTopicAndSection.map((group) => {
                      const isExpanded = expandedTopics.has(group.topicId) || Boolean(deferredSearch.trim());
                      return (
                        <Fragment key={group.topicId}>
                          <tr className="table-topic-header-row" onClick={() => onToggleTopicExpanded(group.topicId)} style={{ cursor: "pointer" }}>
                            <td colSpan={editMode ? 10 : 9} className="table-topic-header-cell">
                              <div className="topic-header-content">
                                <span className="expand-arrow" style={{ color: group.accent }}>
                                  {isExpanded ? "▼" : "▶"}
                                </span>
                                <span className="topic-name">{group.topicName}</span>
                                <span className="topic-stats-badge">
                                  {statusFilter === "revisit" ? `${group.totalCount} Revision items` : `${group.solvedCount} / ${group.totalCount} Solved`}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {isExpanded
                            ? group.sections.map((sectionGroup) => (
                                <SectionBlock
                                  key={sectionGroup.sectionKey}
                                  group={sectionGroup}
                                  accent={group.accent}
                                  canEdit={editMode}
                                  revisionStateMap={revisionStateMap}
                                  problemCategoryMap={problemCategoryMap}
                                  nowDate={nowDate}
                                  justSolvedIds={justSolvedIds}
                                  kbFocusedId={kbFocusedId}
                                  onOpenStudy={onOpenStudy}
                                  onToggleStatus={onToggleStatus}
                                  onOpenEdit={onOpenEdit}
                                  onTogglePin={onTogglePin}
                                  onOpenLink={onOpenLink}
                                  onDelete={onDelete}
                                  rowLimit={sectionRowLimit}
                                  onLoadMore={() => setSectionRowLimit((value) => value + 30)}
                                  isRevisitView={statusFilter === "revisit"}
                                />
                              ))
                            : null}
                        </Fragment>
                      );
                    })
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
                          justSolvedIds={justSolvedIds}
                          kbFocusedId={kbFocusedId}
                          onOpenStudy={onOpenStudy}
                          onToggleStatus={onToggleStatus}
                          onOpenEdit={onOpenEdit}
                          onTogglePin={onTogglePin}
                          onOpenLink={onOpenLink}
                          onDelete={onDelete}
                          rowLimit={sectionRowLimit}
                          onLoadMore={() => setSectionRowLimit((value) => value + 30)}
                          isRevisitView={statusFilter === "revisit"}
                        />
                      ))
                    )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
