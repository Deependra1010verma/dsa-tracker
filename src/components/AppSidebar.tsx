import { topicSubCategories } from "../data/categories";
import type { Status, Topic } from "../appTypes";

type TopicStats = {
  solved: number;
  revisit: number;
  total: number;
};

type AppSidebarProps = {
  isOpen: boolean;
  selectedTopic: string;
  selectedProblemSet: string;
  topics: Topic[];
  problemCount: number;
  generalNotesCount: number;
  dueRevisionCount: number;
  topicStatsMap: Map<string, TopicStats>;
  onOpen: () => void;
  onClose: () => void;
  onRefresh: () => void;
  onProblemSetChange: (problemSet: string) => void;
  onFocusTopic: (topicId: string, nextStatus: Status | "all" | "revisit") => void;
  onOpenRevision: () => void;
  onOpenGeneralNotes: () => void;
};

export function AppSidebar({
  isOpen,
  selectedTopic,
  selectedProblemSet,
  topics,
  problemCount,
  generalNotesCount,
  dueRevisionCount,
  topicStatsMap,
  onOpen,
  onClose,
  onRefresh,
  onProblemSetChange,
  onFocusTopic,
  onOpenRevision,
  onOpenGeneralNotes,
}: AppSidebarProps) {
  return (
    <>
      <header className="mobile-header">
        <button className="menu-btn" onClick={onOpen} aria-label="Open menu">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <span className="mobile-title">DSA Tracker</span>
        <div className="mobile-header-actions">
          <button className="icon-btn" onClick={onRefresh} title="Refresh">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        </div>
      </header>

      {isOpen ? <div className="sidebar-backdrop" onClick={onClose} /> : null}

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header-mobile">
          <span className="sidebar-mobile-title">Topics</span>
          <button className="close-btn" onClick={onClose} aria-label="Close menu">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="brand">
          <div className="brand-mark">DSA</div>
          <div>
            <h1>Tracker</h1>
            <p>Problems and notes.</p>
          </div>
        </div>

        <div className="problem-set-picker">
          <select value={selectedProblemSet} onChange={(event) => onProblemSetChange(event.target.value)}>
            <option value="set1">Main List (Set 1)</option>
            <option value="set2">Problem Set 2</option>
            <option value="set3">Problem Set 3</option>
          </select>
        </div>

        <button className={`topic-card all-topics ${selectedTopic === "all" ? "active" : ""}`} onClick={() => onFocusTopic("all", "all")}>
          <div>
            <span className="topic-name">All Topics</span>
            <span className="topic-subtitle">{problemCount} records</span>
          </div>
          <span className="topic-count">{problemCount}</span>
        </button>

        <button className={`topic-card ${selectedTopic === "revision" ? "active" : ""}`} onClick={onOpenRevision}>
          <div className="topic-dot revision-dot" />
          <div className="topic-copy">
            <span className="topic-name">Revision</span>
            <span className="topic-subtitle">{dueRevisionCount} due today</span>
          </div>
          <span className="topic-count">{dueRevisionCount}</span>
        </button>

        <button
          className={`topic-card ${selectedTopic === "general_notes" ? "active" : ""}`}
          onClick={onOpenGeneralNotes}
          style={{ borderLeft: selectedTopic === "general_notes" ? "3px solid #38bdf8" : undefined }}
        >
          <div className="topic-dot" style={{ background: "#38bdf8" }} />
          <div className="topic-copy">
            <span className="topic-name">📓 General Notes</span>
            <span className="topic-subtitle">Findings & Cheat-sheets</span>
          </div>
          <span className="topic-count" style={{ background: "rgba(56, 189, 248, 0.18)", color: "#38bdf8" }}>
            {generalNotesCount}
          </span>
        </button>

        <div className="topic-list">
          {topics.map((topic) => {
            const active = selectedTopic === topic._id;
            const liveStats = topicStatsMap.get(topic._id) ?? { solved: 0, revisit: 0, total: 0 };
            const subCategories = topicSubCategories[topic.slug] ?? [];

            return (
              <div key={topic._id} className="sidebar-topic-group">
                <button className={`topic-card ${active ? "active" : ""}`} onClick={() => onFocusTopic(topic._id, "all")}>
                  <div className="topic-dot" style={{ background: topic.accent }} />
                  <div className="topic-copy">
                    <span className="topic-name">{topic.name}</span>
                    <span className="topic-subtitle">
                      {liveStats.solved}/{liveStats.total} done
                    </span>
                  </div>
                  <span className="topic-count">{liveStats.total}</span>
                </button>
                {subCategories.length > 0 ? (
                  <div className="topic-subcategory-list" aria-label={`${topic.name} subtopics`}>
                    {subCategories.map((sub) => (
                      <div key={sub.id} className="topic-subcategory-item">
                        {sub.label}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
